import { runSyntheticChecks } from "./local-models.mjs";

const result = runSyntheticChecks();
console.log(JSON.stringify(result, null, 2));
if (result.failed) process.exitCode = 1;
