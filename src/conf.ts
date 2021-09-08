import { readFileSync, writeFileSync } from "fs";

// Configヨミヨミ
// TODO: 型どうにかしたい(JSON.parseはanyを返す)
let conf: any = JSON.parse(readFileSync("./config/config.json", "utf8"));

export function getConf(prop_name: string) {
  let prop_domain = prop_name.split(".");
  let prop_entry = conf;
  for (let i = 0; i < prop_domain.length; i++) {
    if (!prop_entry[prop_domain[i]]) return undefined;
    prop_entry = prop_entry[prop_domain[i]];
  }
  return prop_entry;
}

export function updateConf(prop_name: string, data: string, index?: number) {
  if (!index) index = 1;
  let prop_domain = prop_name.split(".");
  let prop_entry = conf;
  for (let i = 0; i < prop_domain.length - index; i++) {
    if (!prop_entry[prop_domain[i]]) prop_entry[prop_domain[i]] = {};
    prop_entry = prop_entry[prop_domain[i]];
  }
  prop_entry[prop_domain[prop_domain.length - index]] = data;
  if (index == prop_domain.length) {
    conf = prop_entry;
    writeFileSync("./config/config.json", JSON.stringify(conf, null, "\t"));
  } else {
    updateConf(prop_name, prop_entry, ++index);
  }
}
