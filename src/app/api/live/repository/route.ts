import { loadConfig } from "@/lib/config";
import { groupRepoRefs, loadGroupsConfig } from "@/lib/config/groups";
import { GitHubClient } from "@/lib/github/client";
import { repoRefKey } from "@/lib/github/repo";
import {
  getPinnedRepo,
  getRepositoryBranchPipelines,
  getRepositoryPipelines,
} from "@/lib/pipelines";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Projection = "pipelines" | "branches";

function isProjection(value: string | null): value is Projection {
  return value === "pipelines" || value === "branches";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const owner = url.searchParams.get("owner");
  const name = url.searchParams.get("repository");
  const projection = url.searchParams.get("projection");

  if (!owner || !name || !isProjection(projection)) {
    return Response.json({ message: "Invalid live update request." }, { status: 400 });
  }

  const config = loadConfig();
  const groups = await loadGroupsConfig(config.org);
  const repo = { owner, name };
  const key = repoRefKey(repo);
  const configured = [
    ...config.repos,
    ...(groups ? groupRepoRefs(groups) : []),
    ...(groups?.pinned ? [groups.pinned.repo] : []),
  ].some((candidate) => repoRefKey(candidate) === key);
  const belongsToObservedOrg =
    config.org?.toLowerCase() === owner.toLowerCase();

  if (!configured && !belongsToObservedOrg) {
    return Response.json({ message: "Repository is not observed." }, { status: 404 });
  }

  const client = new GitHubClient({
    token: config.token,
    baseUrl: config.apiBaseUrl,
    revalidateSeconds: config.revalidateSeconds,
    cacheMode: "no-store",
  });
  const repository =
    projection === "pipelines"
      ? await getRepositoryPipelines(client, repo)
      : await getRepositoryBranchPipelines(client, repo);
  const pinned =
    groups?.pinned && repoRefKey(groups.pinned.repo) === key
      ? await getPinnedRepo(client, groups.pinned.repo, groups.pinned.environments)
      : null;

  return Response.json({
    generatedAt: new Date().toISOString(),
    repository,
    pinned,
  });
}
