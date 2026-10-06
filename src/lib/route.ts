export type Route = { workspace?: string; campaign?: string; post?: string }

export function parseRoute(hash: string): Route {
  const [, w, workspace, c, campaign, p, post] = hash.replace(/^#/, '').split('/')
  return {
    workspace: w === 'w' ? workspace : undefined,
    campaign: w === 'w' && c === 'c' ? campaign : undefined,
    post: w === 'w' && c === 'c' && p === 'p' ? post : undefined,
  }
}

export function routeHash(route: Route): string {
  if (!route.workspace) return '#/'
  let hash = `#/w/${route.workspace}`
  if (route.campaign) hash += `/c/${route.campaign}`
  if (route.campaign && route.post) hash += `/p/${route.post}`
  return hash
}

export function navigate(route: Route) {
  window.location.hash = routeHash(route)
}
