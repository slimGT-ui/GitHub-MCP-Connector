export interface RepositoryOwner {
  owner: {
    login: string;
  };
}

export interface RepositoryPageOptions {
  page: number;
  per_page: number;
  owner?: string;
}

export type RepositoryPageFetcher<T> = (page: number, perPage: number) => Promise<T[]>;

/**
 * Fetches one API page for unfiltered requests. When filtering by owner,
 * walks GitHub's pages until enough matching repositories are available
 * to satisfy the requested result page.
 */
export async function listRepositories<T extends RepositoryOwner>(
  fetchPage: RepositoryPageFetcher<T>,
  options: RepositoryPageOptions
): Promise<T[]> {
  const { page, per_page, owner } = options;

  if (!owner) {
    return fetchPage(page, per_page);
  }

  const requiredCount = page * per_page;
  const matchingRepositories: T[] = [];

  for (let apiPage = 1; matchingRepositories.length < requiredCount; apiPage += 1) {
    const repositories = await fetchPage(apiPage, 100);
    matchingRepositories.push(
      ...repositories.filter(
        (repository) => repository.owner.login.toLowerCase() === owner.toLowerCase()
      )
    );

    if (repositories.length < 100) {
      break;
    }
  }

  const start = (page - 1) * per_page;
  return matchingRepositories.slice(start, start + per_page);
}
