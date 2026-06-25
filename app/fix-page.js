const fs = require("fs");
const path = require("path");

const filePath = path.join(__dirname, "src/app/(dashboard)/dashboard/page.tsx");
let content = fs.readFileSync(filePath, "utf8");

content = content.replace(
  `className="text-base font-semibold"\n          className="text-3xl font-bold tracking-tight"`,
  `className="text-3xl font-bold tracking-tight text-[#002554]"`
);

fs.writeFileSync(filePath, content, "utf8");
