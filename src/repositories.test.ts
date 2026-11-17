import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { listRepositories } from "./repositories.js";

interface TestRepository {
  owner: { login: string };
  name: string;
}

function repository(owner: string, name: string): TestRepository {
  return { owner: { login: owner }, name };
}

function createFetcher(
  handler: (page: number, perPage: number) => Promise<TestRepository[]>
) {
  const calls: Array<[number, number]> = [];
  const fetchPage = async (page: number, perPage: number) => {
    calls.push([page, perPage]);
    return handler(page, perPage);
  };
  return { fetchPage, calls };
}

describe("listRepositories", () => {
  it("requests the requested page directly when no owner filter is supplied", async () => {
    const { fetchPage, calls } = createFetcher(async (page, perPage) => [
      repository("alice", `page-${page}-size-${perPage}`)
    ]);

    const result = await listRepositories(fetchPage, { page: 3, per_page: 5 });

    assert.deepEqual(result, [repository("alice", "page-3-size-5")]);
    assert.deepEqual(calls, [[3, 5]]);
  });

  it("finds owner repositories on later GitHub API pages", async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) =>
      repository("someone-else", `other-${index}`)
    );
    const secondPage = [
      repository("slimGT-ui", "connector"),
      repository("slimGT-ui", "md-files")
    ];
    const { fetchPage, calls } = createFetcher(async (page) =>
      page === 1 ? firstPage : secondPage
    );

    const result = await listRepositories(fetchPage, {
      page: 1,
      per_page: 10,
      owner: "slimGT-ui"
    });

    assert.deepEqual(result, secondPage);
    assert.deepEqual(calls, [[1, 100], [2, 100]]);
  });

  it("returns the requested result page after filtering across API pages", async () => {
    const firstPage = [
      repository("target", "one"),
      repository("target", "two"),
      repository("target", "three"),
      ...Array.from({ length: 97 }, (_, index) => repository("other", `other-${index}`))
    ];
    const secondPage = [
      repository("target", "four"),
      repository("target", "five"),
      ...Array.from({ length: 98 }, (_, index) => repository("other", `more-${index}`))
    ];
    const { fetchPage, calls } = createFetcher(async (page) =>
      page === 1 ? firstPage : secondPage
    );

    const result = await listRepositories(fetchPage, {
      page: 2,
      per_page: 2,
      owner: "target"
    });

    assert.deepEqual(result, [repository("target", "three"), repository("target", "four")]);
    assert.equal(calls.length, 2);
  });

  it("matches owner names case-insensitively", async () => {
    const { fetchPage } = createFetcher(async () => [
      repository("SlimGT-UI", "connector"),
      repository("another-user", "repo")
    ]);

    const result = await listRepositories(fetchPage, {
      page: 1,
      per_page: 10,
      owner: "slimgt-ui"
    });

    assert.deepEqual(result, [repository("SlimGT-UI", "connector")]);
  });

  it("stops when GitHub returns the final partial page", async () => {
    const { fetchPage, calls } = createFetcher(async () => [
      repository("other", "one"),
      repository("other", "two")
    ]);

    const result = await listRepositories(fetchPage, {
      page: 1,
      per_page: 10,
      owner: "missing"
    });

    assert.deepEqual(result, []);
    assert.deepEqual(calls, [[1, 100]]);
  });
});
