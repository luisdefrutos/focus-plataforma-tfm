const fs = require("fs");
const path = require("path");

function replaceInFile(filePath, replacements) {
  let content = fs.readFileSync(filePath, "utf8");
  for (const { search, replace } of replacements) {
    content = content.replace(search, replace);
  }
  fs.writeFileSync(filePath, content, "utf8");
}

// 1. Sidebar
replaceInFile(path.join(__dirname, "src/components/layout/sidebar.tsx"), [
  {
    search: `className="fixed inset-y-0 left-0 z-40 flex w-60 flex-col"
      style={{
        background: 'var(--ts-semantic-color-background-primary-dark-default)',
        color: 'var(--ts-semantic-color-text-inverted-default)',
      }}`,
    replace: `className="fixed inset-y-0 left-0 z-40 flex w-60 flex-col bg-slate-900 text-slate-50"`
  },
  {
    search: `style={{ background: 'var(--ts-semantic-color-text-inverted-default)' }}`,
    replace: `className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-white"`
  },
  {
    search: `className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md"`,
    replace: ``
  },
  {
    search: `style={{
                background: active ? 'var(--ts-semantic-color-background-primary-default)' : 'transparent',
              }}`,
    replace: `className={cn(
                'group flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                active ? 'font-semibold bg-blue-600 text-white' : 'opacity-80 hover:opacity-100'
              )}`
  },
  {
    search: `className={cn(
                'group flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                active
                  ? 'font-semibold'
                  : 'opacity-80 hover:opacity-100',
              )}`,
    replace: `` // removed because combined above
  },
  {
    search: `style={{
                    background: 'var(--ts-semantic-color-background-danger-default)',
                    color: 'var(--ts-semantic-color-text-inverted-default)',
                  }}`,
    replace: `className="rounded-full px-2 py-0.5 text-[10px] font-medium bg-red-600 text-white"`
  },
  {
    search: `className="rounded-full px-2 py-0.5 text-[10px] font-medium"`,
    replace: ``
  }
]);

// 2. Topbar
replaceInFile(path.join(__dirname, "src/components/layout/topbar.tsx"), [
  {
    search: `className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b px-6"
      style={{
        background: 'var(--ts-semantic-color-surface-default)',
        borderColor: 'var(--ts-semantic-color-border-base-default)',
      }}`,
    replace: `className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b px-6 bg-background"`
  },
  {
    search: `className="flex items-center pl-4 border-l" style={{ borderColor: 'var(--ts-semantic-color-border-base-default)' }}`,
    replace: `className="flex items-center pl-4 border-l border-border"`
  }
]);

// 3. KPI Card
replaceInFile(path.join(__dirname, "src/components/ui/kpi-card.tsx"), [
  {
    search: `style={{
        background: 'var(--ts-semantic-color-surface-default)',
        borderColor: 'var(--ts-semantic-color-border-base-default)',
      }}`,
    replace: `className={cn('flex items-start gap-4 rounded-lg border bg-card text-card-foreground p-5 transition-shadow hover:shadow-sm')}`
  },
  {
    search: `className={cn(
        'flex items-start gap-4 rounded-lg border p-5 transition-shadow hover:shadow-sm',
      )}`,
    replace: ``
  },
  {
    search: `style={{ color: 'var(--ts-semantic-color-text-secondary-default)' }}`,
    replace: `className="text-xs font-medium uppercase tracking-wider text-muted-foreground"`
  },
  {
    search: `className="text-xs font-medium uppercase tracking-wider"`,
    replace: ``
  },
  {
    search: `style={{ color: 'var(--ts-semantic-color-text-primary-default)' }}`,
    replace: `className="mt-1 truncate text-2xl font-bold leading-tight"`
  },
  {
    search: `className="mt-1 truncate text-2xl font-bold leading-tight"`,
    replace: ``
  },
  {
    search: `style={{ color: 'var(--ts-semantic-color-text-tertiary-default)' }}`,
    replace: `className="mt-1 text-xs text-muted-foreground"`
  },
  {
    search: `className="mt-1 text-xs"`,
    replace: ``
  },
  {
    search: `style={{ background: TONE_BG[tone] }}`,
    replace: ``
  },
  {
    search: `className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md"`,
    replace: `className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-md", 
      tone === 'success' && 'bg-green-100 text-green-700',
      tone === 'danger' && 'bg-red-100 text-red-700',
      tone === 'primary' && 'bg-blue-100 text-blue-700',
      tone === 'neutral' && 'bg-gray-100 text-gray-700'
    )}`
  },
  {
    search: `style={{ '--icon-color': TONE_COLOR[tone] } as React.CSSProperties}`,
    replace: `className="currentColor"`
  }
]);

// 4. Page (ChartCard)
replaceInFile(path.join(__dirname, "src/app/(dashboard)/dashboard/page.tsx"), [
  {
    search: `style={{
        background: 'var(--ts-semantic-color-surface-default)',
        borderColor: 'var(--ts-semantic-color-border-base-default)',
      }}`,
    replace: ``
  },
  {
    search: `className={\`rounded-lg border p-6 \${className}\`}`,
    replace: `className={\`rounded-lg border bg-card text-card-foreground p-6 \${className}\`}`
  },
  {
    search: `style={{ color: 'var(--ts-semantic-color-text-primary-default)' }}`,
    replace: `className="text-base font-semibold"`
  },
  {
    search: `className="text-base font-semibold"`,
    replace: ``
  },
  {
    search: `style={{ color: 'var(--ts-semantic-color-text-tertiary-default)' }}`,
    replace: `className="mt-0.5 text-xs text-muted-foreground"`
  },
  {
    search: `className="mt-0.5 text-xs"`,
    replace: ``
  },
  {
    search: `style={{ color: 'var(--ts-semantic-color-text-primary-default)' }}`,
    replace: `className="text-3xl font-bold tracking-tight"`
  },
  {
    search: `className="text-3xl font-bold tracking-tight"`,
    replace: ``
  },
  {
    search: `style={{ color: 'var(--ts-semantic-color-text-secondary-default)' }}`,
    replace: `className="mt-1 text-sm text-muted-foreground"`
  },
  {
    search: `className="mt-1 text-sm"`,
    replace: ``
  }
]);
