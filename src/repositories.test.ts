import { describe, expect, it, vi } from "vitest";
import { listRepositories } from "./repositories.js";

interface TestRepository {
  owner: { login: string };
  name: string;
}

function repository(owner: string, name: string): TestRepository {
  return { owner: { login: owner }, name };
}

describe("listRepositories", () => {
  it("requests the requested page directly when no owner filter is supplied", async () => {
    const fetchPage = vi.fn(async (page: number, perPage: number) => [
      repository("alice", `page-${page}-size-${perPage}`)
    ]);

    const result = await listRepositories(fetchPage, { page: 3, per_page: 5 });

    expect(result).toEqual([repository("alice", "page-3-size-5")]);
    expect(fetchPage).toHaveBeenCalledExactlyOnceWith(3, 5);
  });

  it("finds owner repositories on later GitHub API pages", async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) =>
      repository("someone-else", `other-${index}`)
    );
    const secondPage = [
      repository("slimGT-ui", "connector"),
      repository("slimGT-ui", "md-files")
    ];
    const fetchPage = vi.fn(async (page: number) => page === 1 ? firstPage : secondPage);

    const result = await listRepositories(fetchPage, {
      page: 1,
      per_page: 10,
      owner: "slimGT-ui"
    });

    expect(result).toEqual(secondPage);
    expect(fetchPage).toHaveBeenCalledTimes(2);
    expect(fetchPage).toHaveBeenNthCalledWith(1, 1, 100);
    expect(fetchPage).toHaveBeenNthCalledWith(2, 2, 100);
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
    const fetchPage = vi.fn(async (page: number) => page === 1 ? firstPage : secondPage);

    const result = await listRepositories(fetchPage, {
      page: 2,
      per_page: 2,
      owner: "target"
    });

    expect(result).toEqual([repository("target", "three"), repository("target", "four")]);
    expect(fetchPage).toHaveBeenCalledTimes(2);
  });

  it("matches owner names case-insensitively", async () => {
    const fetchPage = vi.fn(async () => [
      repository("SlimGT-UI", "connector"),
      repository("another-user", "repo")
    ]);

    const result = await listRepositories(fetchPage, {
      page: 1,
      per_page: 10,
      owner: "slimgt-ui"
    });

    expect(result).toEqual([repository("SlimGT-UI", "connector")]);
  });

  it("stops when GitHub returns the final partial page", async () => {
    const fetchPage = vi.fn(async () => [
      repository("other", "one"),
      repository("other", "two")
    ]);

    const result = await listRepositories(fetchPage, {
      page: 1,
      per_page: 10,
      owner: "missing"
    });

    expect(result).toEqual([]);
    expect(fetchPage).toHaveBeenCalledExactlyOnceWith(1, 100);
  });
});
