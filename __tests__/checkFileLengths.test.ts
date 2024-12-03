import { describe, it, expect, vi, beforeEach } from "vitest";
import { checkFileLengths } from "../checkFileLengths";

const { stat, readdir, readFile } = vi.hoisted(() => ({
  stat: vi.fn(),
  readdir: vi.fn(),
  readFile: vi.fn(),
}));

describe("checkFileLengths", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    readFile.mockResolvedValue(""); // Mock empty .gitignore
  });

  it("should handle missing gitignore file", async () => {
    readFile.mockRejectedValueOnce(new Error("ENOENT")); // Simulate missing .gitignore
    stat.mockResolvedValue({
      isDirectory: () => false,
      isFile: () => true,
    });
    readFile.mockResolvedValueOnce("content");

    const result = await checkFileLengths(
      { stat, readdir, readFile },
      ["test.js"],
      { useGitignore: true }
    );
    expect(result).toHaveLength(0);
  });

  it("should suppress output when silent is true", async () => {
    stat.mockResolvedValue({
      isDirectory: () => false,
      isFile: () => true,
    });
    readFile.mockResolvedValue("a\n".repeat(150));

    const result = await checkFileLengths(
      { stat, readdir, readFile },
      ["test.js"],
      {
        threshold: 100,
        silent: true,
      }
    );

    expect(result).toHaveLength(1);
  });

  it("should skip non-file entries", async () => {
    stat.mockResolvedValue({
      isDirectory: () => false,
      isFile: () => false, // Neither file nor directory
    });

    const result = await checkFileLengths(
      { stat, readdir, readFile },
      ["not-a-file"],
      { throwOnFound: false }
    );

    expect(result).toHaveLength(0);
  });

  it("should handle directories with multiple files", async () => {
    stat
      .mockResolvedValueOnce({
        isDirectory: () => true,
        isFile: () => false,
      })
      .mockResolvedValueOnce({
        isDirectory: () => false,
        isFile: () => true,
      })
      .mockResolvedValueOnce({
        isDirectory: () => false,
        isFile: () => true,
      });

    readdir.mockResolvedValue(["file1.js", "file2.js"]);
    readFile
      .mockResolvedValueOnce("") // .gitignore
      .mockResolvedValueOnce("content1")
      .mockResolvedValueOnce("content2");

    const result = await checkFileLengths(
      { stat, readdir, readFile },
      ["test-dir"],
      { throwOnFound: false }
    );

    expect(result).toHaveLength(0);
    expect(readdir).toHaveBeenCalledTimes(1);
  });

  it("should handle errors in processFiles", async () => {
    stat.mockRejectedValue(new Error("File access error"));

    await expect(
      checkFileLengths({ stat, readdir, readFile }, ["error.js"])
    ).rejects.toThrow("File access error");
  });

  it("should handle errors in processFiles when silent", async () => {
    stat.mockRejectedValue(new Error("File access error"));

    const result = await checkFileLengths(
      { stat, readdir, readFile },
      ["error.js"],
      { silent: true }
    );

    expect(result).toEqual([]);
  });

  it("should handle ignore patterns correctly", async () => {
    stat.mockResolvedValue({
      isDirectory: () => false,
      isFile: () => true,
    });
    readFile.mockResolvedValue("content\n".repeat(10));

    const result = await checkFileLengths(
      { stat, readdir, readFile },
      ["test.js", "test.ts", "test.jsx"],
      {
        ignore: ".js,.jsx",
        throwOnFound: false,
      }
    );

    expect(result).toHaveLength(0);
    expect(readFile).toHaveBeenCalledTimes(2); // Once for .gitignore, once for test.ts
  });

  it("should handle file read errors when processing files", async () => {
    stat.mockResolvedValue({
      isDirectory: () => false,
      isFile: () => true,
    });
    readFile
      .mockResolvedValueOnce("") // .gitignore
      .mockRejectedValueOnce(new Error("File read error"));

    const result = await checkFileLengths(
      { stat, readdir, readFile },
      ["test.js"],
      { throwOnFound: false }
    );

    expect(result).toHaveLength(0);
  });

  it("should throw error on file read failure when throwOnFound is true", async () => {
    stat.mockResolvedValue({
      isDirectory: () => false,
      isFile: () => true,
    });
    readFile
      .mockResolvedValueOnce("") // .gitignore
      .mockRejectedValueOnce(new Error("File read error"));

    await expect(
      checkFileLengths({ stat, readdir, readFile }, ["test.js"])
    ).rejects.toThrow("File read error");
  });

  it("should throw error when files exceed threshold and throwOnFound is true", async () => {
    stat.mockResolvedValue({
      isDirectory: () => false,
      isFile: () => true,
    });
    readFile
      .mockResolvedValueOnce("") // .gitignore
      .mockResolvedValueOnce("a\n".repeat(150));

    const consoleSpy = vi.spyOn(console, "log");

    await expect(
      checkFileLengths({ stat, readdir, readFile }, ["test.js"], {
        threshold: 100,
      })
    ).rejects.toThrow("Files exceeding 100 lines:");

    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it("should log message when files exceed threshold and throwOnFound is false", async () => {
    stat.mockResolvedValue({
      isDirectory: () => false,
      isFile: () => true,
    });
    readFile
      .mockResolvedValueOnce("") // .gitignore
      .mockResolvedValueOnce("a\n".repeat(150));

    const consoleSpy = vi.spyOn(console, "log");

    const result = await checkFileLengths(
      { stat, readdir, readFile },
      ["test.js"],
      { threshold: 100, throwOnFound: false }
    );

    expect(result).toHaveLength(1);
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("Files exceeding 100 lines:")
    );
  });

  it("should not log or throw when files exceed threshold and silent is true", async () => {
    stat.mockResolvedValue({
      isDirectory: () => false,
      isFile: () => true,
    });
    readFile
      .mockResolvedValueOnce("") // .gitignore
      .mockResolvedValueOnce("a\n".repeat(150));

    const consoleSpy = vi.spyOn(console, "log");

    const result = await checkFileLengths(
      { stat, readdir, readFile },
      ["test.js"],
      { threshold: 100, silent: true }
    );

    expect(result).toHaveLength(1);
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it("should handle empty filePaths array", async () => {
    const result = await checkFileLengths({ stat, readdir, readFile }, [], {
      silent: true,
    });

    expect(result).toHaveLength(0);
  });

  it("should handle non-file entries when silent is false", async () => {
    stat.mockResolvedValue({
      isDirectory: () => false,
      isFile: () => false, // Neither file nor directory
    });

    const result = await checkFileLengths(
      { stat, readdir, readFile },
      ["not-a-file"],
      { silent: false }
    );

    expect(result).toHaveLength(0);
  });

  it("should handle non-file entries when silent is true", async () => {
    stat.mockResolvedValue({
      isDirectory: () => false,
      isFile: () => false, // Neither file nor directory
    });

    const result = await checkFileLengths(
      { stat, readdir, readFile },
      ["not-a-file"],
      { silent: true }
    );

    expect(result).toHaveLength(0);
  });

  it("should log error when accessing path fails and not silent", async () => {
    stat.mockRejectedValue(new Error("Access error"));
    const consoleSpy = vi.spyOn(console, "error");

    await checkFileLengths({ stat, readdir, readFile }, ["test.js"], {
      throwOnFound: false,
    });

    expect(consoleSpy).toHaveBeenCalledWith(
      "Error accessing path: test.js",
      expect.any(Error)
    );
  });

  it("should skip non-file entries during processing", async () => {
    stat.mockResolvedValue({
      isDirectory: () => false,
      isFile: () => false,
    });
    const readFileSpy = vi.spyOn({ readFile }, "readFile");

    await checkFileLengths({ stat, readdir, readFile }, ["test.js"], {
      throwOnFound: false,
      useGitignore: false,
    });

    expect(readFileSpy).not.toHaveBeenCalled();
  });

  it("should handle top-level errors and log when not silent", async () => {
    stat.mockRejectedValue(new Error("Critical error"));
    const consoleSpy = vi.spyOn(console, "error");

    const result = await checkFileLengths(
      { stat, readdir, readFile },
      ["test.js"],
      { throwOnFound: false }
    );

    expect(result).toEqual([]);
    expect(consoleSpy).toHaveBeenCalledWith(
      "Error accessing path: test.js",
      expect.any(Error)
    );
  });
});
