const fs = require('fs')

// Configヨミヨミ
let conf = JSON.parse(fs.readFileSync('./config/config.json', 'utf8'))

function get(prop_name) {
    let prop_domain = prop_name.split(".")
    let prop_entry = conf;
    for (let i = 0; i < prop_domain.length;i++) {
        if (!prop_entry[prop_domain[i]]) return undefined
        prop_entry = prop_entry[prop_domain[i]]
    }
    return prop_entry
}

function update(prop_name, data, index) {
    if (!index) index = 1
    let prop_domain = prop_name.split(".")
    let prop_entry = conf;
    for (let i = 0; i < prop_domain.length - index;i++) {
        if (!prop_entry[prop_domain[i]]) prop_entry[prop_domain[i]] = {}
        prop_entry = prop_entry[prop_domain[i]]
    }
    prop_entry[prop_domain[prop_domain.length - index]] = data
    if (index == prop_domain.length) {
        conf = prop_entry
        fs.writeFileSync("./config/config.json", JSON.stringify(conf, null, "\t"))
    } else {
        update(prop_name, prop_entry, ++index)
    }
}

module.exports = {get, update}