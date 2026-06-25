const fs = require("fs");
const path = require("path");

function replaceInFile(filePath, replacements) {
  let content = fs.readFileSync(filePath, "utf8");
  for (const { search, replace } of replacements) {
    content = content.replace(search, replace);
  }
  fs.writeFileSync(filePath, content, "utf8");
}

replaceInFile(path.join(__dirname, "src/components/buscador/filter-bar.tsx"), [
  {
    search: `className="space-y-3 rounded-lg border p-4"
      style={{
        background: 'var(--ts-semantic-color-surface-default)',
        borderColor: 'var(--ts-semantic-color-border-base-default)',
      }}`,
    replace: `className="space-y-4 rounded-lg border bg-card text-card-foreground p-5"`
  },
  {
    search: `className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"`,
    replace: `className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"`
  },
  {
    search: `className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5"`,
    replace: `className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5"`
  },
  {
    search: `className="flex flex-wrap items-center justify-between gap-3 pt-1"`,
    replace: `className="flex flex-wrap items-center justify-between gap-4 pt-2"`
  },
  {
    search: `className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm"`,
    replace: `className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm"`
  }
]);

replaceInFile(path.join(__dirname, "src/components/buscador/code-multi-combobox.tsx"), [
  {
    search: `className="flex flex-col gap-1 w-full"`,
    replace: `className="flex flex-col gap-1.5 w-full"`
  },
  {
    search: `className="text-sm text-[var(--ts-semantic-color-text-secondary-default)] font-medium"`,
    replace: `className="text-sm font-medium leading-none"`
  }
]);
