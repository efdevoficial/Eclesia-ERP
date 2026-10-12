const fs = require("fs");
const path = require("path");

const packagePath = path.join(__dirname, "../package.json");
const messageFile = process.argv[2];

if (!messageFile || !fs.existsSync(messageFile)) {
  console.error("Informe o arquivo com a mensagem do commit.");
  process.exit(1);
}

const message = fs.readFileSync(messageFile, "utf8").trim();
const match = message.match(/^(feat|fix|master)(?:\([^)]*\))?:/i);

if (!match) {
  console.log("Commit sem prefixo de versionamento; versão mantida.");
  process.exit(0);
}

const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));
const version = packageJson.version.split(".").map(Number);

if (
  version.length !== 3 ||
  version.some((part) => !Number.isInteger(part) || part < 0)
) {
  console.error("Versão inválida no package.json.");
  process.exit(1);
}

switch (match[1].toLowerCase()) {
  case "master":
    version[0] += 1;
    version[1] = 0;
    version[2] = 0;
    break;
  case "feat":
    version[1] += 1;
    version[2] = 0;
    break;
  case "fix":
    version[2] += 1;
    break;
}

packageJson.version = version.join(".");

fs.writeFileSync(
  packagePath,
  JSON.stringify(packageJson, null, 2) + "\n"
);

console.log(`Versão atualizada para ${packageJson.version}.`);