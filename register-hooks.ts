import { register } from "node:module";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const hookUrl = pathToFileURL(resolve("loader-hooks.mjs")).href;
register(hookUrl);
