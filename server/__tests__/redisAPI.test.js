const redisAPI = require("../utils/redisAPI");

describe("redisAPI", () => {
  let mockRedis;
  let client;
  let testUser;

  beforeEach(async () => {
    mockRedis = {
      set: jest.fn(),
      get: jest.fn(),
      expire: jest.fn(),
    };
    client = new redisAPI(mockRedis);
    testUser = {
      id: "123456",
      username: "user123",
      color: "#FFFFFF",
    };

    await client.addUser("doc123", testUser);
  });

  test("addUser", async () => {
    expect(mockRedis.set).toHaveBeenCalledWith(
      "users:doc123",
      JSON.stringify([testUser])
    );
  });

  test("removeUser", async () => {
    await client.removeUser("doc123", testUser);
    expect(mockRedis.set).toHaveBeenCalledWith(
      "users:doc123",
      JSON.stringify([])
    );
  });

  test("getUsers", async () => {
    await client.getUsers("doc123");
    expect(mockRedis.get).toHaveBeenCalledWith("users:doc123");
  });

  test("initDoc", async () => {
    await client.initDoc("docABC");
    expect(mockRedis.set).toHaveBeenCalledWith("doc:docABC", "");
  });
});
