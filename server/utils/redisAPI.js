const TTL_SECONDS = 86400; // 24 hours

module.exports = class {
  constructor(client) {
    this.client = client;
  }

  initDoc = async (id) => {
    const data = await this.getDoc(id);
    if (data) return JSON.parse(data);
    await this.setDoc(id, "");
    return "";
  };

  setDoc = async (id, value = "") => {
    await this.client.set(`doc:${id}`, value);
    await this.client.expire(`doc:${id}`, TTL_SECONDS);
  };

  getDoc = async (id) => {
    const doc = await this.client.get(`doc:${id}`);
    return doc;
  };

  getUsers = async (docId) => {
    const users = await this.client.get(`users:${docId}`);
    return users ? JSON.parse(users) : [];
  };

  addUser = async (docId, user) => {
    const users = await this.getUsers(docId);
    const filtered = users.filter((u) => u.id !== user.id);
    filtered.push(user);
    await this.client.set(`users:${docId}`, JSON.stringify(filtered));
  };

  removeUser = async (docId, socketId) => {
    const users = await this.getUsers(docId);
    const filtered = users.filter((u) => u.id !== socketId);
    await this.client.set(`users:${docId}`, JSON.stringify(filtered));
  };
};
