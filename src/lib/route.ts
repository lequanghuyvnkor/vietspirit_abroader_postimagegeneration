export type Route = { workspace?: string; campaign?: string; post?: string; piece?: string }

export function parseRoute(hash: string): Route {
  const [, w, workspace, c, campaign, kind, id] = hash.replace(/^#/, '').split('/')
  const inCampaign = w === 'w' && c === 'c'
  return {
    workspace: w === 'w' ? workspace : undefined,
    campaign: inCampaign ? campaign : undefined,
    post: inCampaign && kind === 'p' ? id : undefined,
    piece: inCampaign && kind === 'k' ? id : undefined,
  }
}

export function routeHash(route: Route): string {
  if (!route.workspace) return '#/'
  let hash = `#/w/${route.workspace}`
  if (route.campaign) hash += `/c/${route.campaign}`
  if (route.campaign && route.post) hash += `/p/${route.post}`
  if (route.campaign && route.piece) hash += `/k/${route.piece}`
  return hash
}

export function navigate(route: Route) {
  window.location.hash = routeHash(route)
}
