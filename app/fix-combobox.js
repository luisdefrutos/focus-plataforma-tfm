const fs = require("fs");
const path = require("path");

function replaceInFile(filePath, replacements) {
  let content = fs.readFileSync(filePath, "utf8");
  for (const { search, replace } of replacements) {
    content = content.replace(search, replace);
  }
  fs.writeFileSync(filePath, content, "utf8");
}

replaceInFile(path.join(__dirname, "src/components/buscador/code-multi-combobox.tsx"), [
  {
    search: `style={chipStyle}`,
    replace: `className={\`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs \${mode === 'exclude' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}\`}`
  },
  {
    search: `className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs"`,
    replace: `` // removed because combined above
  },
  {
    search: `style={{
            background: 'var(--ts-semantic-color-surface-default)',
            borderColor: 'var(--ts-semantic-color-border-base-default)',
            color: 'var(--ts-semantic-color-text-tertiary-default)',
          }}`,
    replace: `className="absolute z-20 mt-1 w-full rounded-md border bg-popover text-muted-foreground px-3 py-2 text-sm shadow-lg"`
  },
  {
    search: `className="absolute z-20 mt-1 w-full rounded-md border px-3 py-2 text-sm shadow-lg"`,
    replace: `` // combined
  },
  {
    search: `style={{
            background: 'var(--ts-semantic-color-surface-default)',
            borderColor: 'var(--ts-semantic-color-border-base-default)',
          }}`,
    replace: `className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border bg-popover text-popover-foreground py-1 shadow-lg"`
  },
  {
    search: `className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border py-1 shadow-lg"`,
    replace: `` // combined
  },
  {
    search: `hover:bg-[var(--ts-semantic-color-background-base-hover)]`,
    replace: `hover:bg-accent hover:text-accent-foreground`
  },
  {
    search: `style={{ color: 'var(--ts-semantic-color-text-tertiary-default)' }}`,
    replace: `className="text-muted-foreground"`
  }
]);
