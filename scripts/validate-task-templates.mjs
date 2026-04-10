import path from "node:path";
import { buildTaskPayload, listTemplateDirs } from "./task-template-lib.mjs";

async function main() {
  const templateDirs = await listTemplateDirs();
  if (templateDirs.length === 0) {
    throw new Error("No task templates found in task-templates/");
  }

  for (const templateDir of templateDirs) {
    const payload = await buildTaskPayload(templateDir);
    console.log(
      `${path.basename(templateDir)}: ok (${payload.files.length} files, entrypoint=${payload.entrypoint})`,
    );
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
