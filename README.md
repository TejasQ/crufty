# crufty

> Because we all accumulate cruft over time.

A command-line tool to check for files that exceed specified line count thresholds in your codebase. Perfect for maintaining code quality and identifying potentially complex files that might need refactoring.

## Installation

```bash
npm install -D crufty
# or
pnpm add -D crufty
# or
yarn add -D crufty
```

## Usage

```bash
crufty ./**.{ts,js,jsx,astro} [options]
```

By default, `crufty` will check all files in the current directory against a threshold of 100 lines. You can specify file patterns or paths to check specific files.

### Examples

```bash
# Check all files in current directory
crufty

# Check specific files or patterns
crufty src/**/*.ts src/**/*.js

# Set custom line threshold
crufty --threshold 200

# Warn instead of throwing error
crufty --warn

# Ignore specific patterns
crufty --ignore "*.test.ts,*.spec.js"
```

### Options

- `-t, --threshold <number>`: Line count threshold (default: 100)
- `-w, --warn`: Warn instead of throwing error (default: false)
- `--no-gitignore`: Disable gitignore patterns
- `-s, --silent`: Suppress all output except errors
- `-i, --ignore <patterns>`: Additional patterns to ignore (comma-separated)
- `-v, --version`: Output the version number
- `-h, --help`: Display help for command

## Using with lint-staged and husky

You can use crufty as part of your pre-commit hooks to prevent committing files that exceed your line count threshold. Here's how to set it up:

1. Install the required dependencies:

```bash
npm install -D lint-staged husky
# or
pnpm add -D lint-staged husky
# or
yarn add -D lint-staged husky
```

2. Initialize husky:

```bash
npx husky
```

3. Add the following to your `package.json`:

```json
{
  "scripts": {
    "prepare": "husky install"
  },
  "lint-staged": {
    "*.{js,jsx,ts,tsx,astro}": ["crufty"]
  }
}
```

4. Add the pre-commit hook:

```bash
npx husky add .husky/pre-commit "npx lint-staged"
```

Now crufty will run on all staged files before each commit, preventing commits that would introduce files exceeding your line count threshold.
