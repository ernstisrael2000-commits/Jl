// Evaluates the {[...].map(...).join('')} JS expressions embedded as literal
// text in the exported design HTML files, and replaces them with their
// rendered static HTML output, producing fully working static pages.
const fs = require("fs");
const path = require("path");

const srcDir = path.join(__dirname, "..", "design_export");
const outDir = path.join(__dirname, "..", "public");

fs.mkdirSync(outDir, { recursive: true });

function findExprs(text) {
  const exprs = [];
  let i = 0;
  while (i < text.length) {
    if (text[i] === "{") {
      // scan forward to find the matching closing brace, respecting
      // backtick template literals (which may themselves contain {..} for
      // ${} interpolation) and nested braces.
      let depth = 0;
      let j = i;
      let inTemplate = false;
      let templateDepth = 0;
      for (; j < text.length; j++) {
        const c = text[j];
        if (inTemplate) {
          if (c === "`") inTemplate = false;
          else if (c === "$" && text[j + 1] === "{") {
            templateDepth++;
            j++;
          } else if (c === "}" && templateDepth > 0) {
            templateDepth--;
          }
          continue;
        }
        if (c === "`") {
          inTemplate = true;
          continue;
        }
        if (c === "{") depth++;
        else if (c === "}") {
          depth--;
          if (depth === 0) break;
        }
      }
      const candidate = text.slice(i, j + 1);
      const inner = candidate.slice(1, -1);
      if (/\.map\(/.test(inner) && /\.join\(/.test(inner)) {
        exprs.push({ start: i, end: j + 1, inner });
      }
      i = j + 1;
    } else {
      i++;
    }
  }
  return exprs;
}

for (const file of fs.readdirSync(srcDir).filter((f) => f.endsWith(".html"))) {
  let html = fs.readFileSync(path.join(srcDir, file), "utf8");
  const exprs = findExprs(html);
  // Replace from the end so earlier indices stay valid.
  for (const { start, end, inner } of exprs.reverse()) {
    let rendered;
    try {
      // eslint-disable-next-line no-eval
      rendered = eval(inner);
    } catch (e) {
      console.error(`Failed to eval expr in ${file}:`, inner.slice(0, 80), e.message);
      rendered = "";
    }
    html = html.slice(0, start) + rendered + html.slice(end);
  }
  fs.writeFileSync(path.join(outDir, file), html);
  console.log(`Rendered ${file} (${exprs.length} expressions)`);
}
