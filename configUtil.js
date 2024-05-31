import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

export async function getConfig(filename, defaultConfig) {

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);

    const configDir = path.join(__dirname, 'config');
    const configFilePath = path.join(configDir, `${filename}.json`);

    // Ensure config directory exists
    if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir);
    }

    // Ensure config file exists, if not create with default config and exit
    if (!fs.existsSync(configFilePath)) {
        fs.writeFileSync(configFilePath, JSON.stringify(defaultConfig, null, 2));
        console.log(`Default config file created at ${configFilePath}. Please edit the file and restart the server.`);
        process.exit(0);
    }

    // Read config file
    let config = JSON.parse(fs.readFileSync(configFilePath, 'utf8'));

    for (var key in defaultConfig) {
        if (!config.hasOwnProperty(key)) {
          config[key] = defaultConfig[key]
        }
    }

    fs.writeFileSync(configFilePath, JSON.stringify(config, null, 2));
    return config

}

export default getConfig;