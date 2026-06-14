const fs = require("fs");
const path = require("path");

class JsonStorage {
     constructor(filename) {
          this.filePath = path.join(__dirname, `../data/${filename}`);
          // Ensure directory exists
          const dir = path.dirname(this.filePath);
          if (!fs.existsSync(dir)) {
               fs.mkdirSync(dir, { recursive: true });
          }
     }

     loadJson() {
          try {
               if (!fs.existsSync(this.filePath)) return {};
               const data = fs.readFileSync(this.filePath, "utf8");
               return JSON.parse(data);
          } catch (error) {
               console.error(`[JSONStorage] Gagal memuat file JSON (${this.filePath}):`, error);
               return {};
          }
     }

     saveJson(data) {
          try {
               fs.writeFileSync(this.filePath, JSON.stringify(data, null, 4), "utf8");
          } catch (error) {
               console.error(`[JSONStorage] Gagal menyimpan file JSON (${this.filePath}):`, error);
          }
     }

     get(key) {
          const data = this.loadJson();
          return data[key] || null;
     }

     set(key, value) {
          const data = this.loadJson();
          data[key] = value;
          this.saveJson(data);
     }
}

// Keep backward compatibility for the existing last_messages.json use cases
const defaultStorage = new JsonStorage("last_messages.json");
const getLastMessageId = (key) => defaultStorage.get(key);
const saveLastMessageId = (key, messageId) => defaultStorage.set(key, messageId);

module.exports = { JsonStorage, getLastMessageId, saveLastMessageId };
