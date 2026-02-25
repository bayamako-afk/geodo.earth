import * as io from "./io.js";
import * as pack from "./pack.js";
import * as model from "./model.js";
import * as validate from "./validate.js";
import * as query from "./query.js";
import * as ops from "./ops.js";
import * as create from "./create.js";
import * as adapters from "../adapters/index.js";

export function createGOS() {
  return {
    meta: { coreVersion: "0.1.0", supportedPackVersions: ["0.1"] },
    io, pack, model, validate, query, ops, create, adapters,
  };
}