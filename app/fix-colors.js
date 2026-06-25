const fs = require("fs");
const path = require("path");

function replaceInFile(filePath, replacements) {
  let content = fs.readFileSync(filePath, "utf8");
  for (const { search, replace } of replacements) {
    content = content.replace(search, replace);
  }
  fs.writeFileSync(filePath, content, "utf8");
}

replaceInFile(path.join(__dirname, "src/app/globals.css"), [
  {
    search: `--primary: oklch(0.205 0 0);`,
    replace: `--primary: #002554;`
  },
  {
    search: `--primary-foreground: oklch(0.985 0 0);`,
    replace: `--primary-foreground: #ffffff;`
  },
  {
    search: `--sidebar: oklch(0.985 0 0);`,
    replace: `--sidebar: #002554;`
  },
  {
    search: `--sidebar-foreground: oklch(0.145 0 0);`,
    replace: `--sidebar-foreground: #ffffff;`
  }
]);

replaceInFile(path.join(__dirname, "src/components/layout/sidebar.tsx"), [
  {
    search: `bg-slate-900 text-slate-50`,
    replace: `bg-sidebar text-sidebar-foreground`
  },
  {
    search: `bg-blue-600 text-white`,
    replace: `bg-primary/20 text-primary-foreground`
  }
]);

