import { All, Controller, HttpCode, Req, Res } from '@nestjs/common';
import type { Response } from 'express';
import { NcRequest } from 'nocodb-sdk';

const NOT_FOUND_PATH_PREFIX = '/api/v3/*';

// CE local-dev shim: the EE-flavored frontend hits v3 endpoints that
// have no CE implementation (skills catalog, policy, etc.). When they
// don't match a specific route, they fall through to this wildcard and
// get a 404. Mirror the ApiVersionNotFoundController logic — match
// known EE v3 patterns and return empty shapes so the patched UI
// doesn't see 404s in console.
//
// Patterns are deliberately separate from ApiVersionNotFoundController
// because that controller's @All only covers /api/v1 and /api/v2.
const EE_STUB_PATTERNS_V3: RegExp[] = [
  // /api/v3/meta/orgs/:orgId/skills/* — catalog, policy, individual skill
  /^\/api\/v3\/meta\/orgs\/[^/]+\/skills\/(catalog|policy)/,
  /^\/api\/v3\/meta\/orgs\/[^/]+\/skills\/[^/]+$/,
  /^\/api\/v3\/meta\/orgs\/[^/]+\/skills\/[^/]+\/[^/]+$/,
  // /api/v3/meta/orgs/:orgId/skill-policies[/...]
  /^\/api\/v3\/meta\/orgs\/[^/]+\/skill-polic(y|ies)/,
  // /api/v3/meta/orgs/:orgId/{teams,workflows,interfaces,...}
  // (EE-flavored frontend probes all these; CE has no implementation).
  // Match the resource name explicitly so we don't shadow real CE routes
  // that might exist for any of these.
  //
  // Note: `dashboards` is intentionally excluded from this list because
  // DashboardsController (registered in NocoModule) implements real CRUD
  // for `/api/v3/meta/bases/:baseId/dashboards*`. Listing it here would
  // short-circuit before the real controller could run.
  /^\/api\/v3\/meta\/orgs\/[^/]+\/(teams|workflows|interfaces|documents|agents|usage|plans|seats|audit|billing|integrations|connections|domains|sso-clients|workspaces)/,
  /^\/api\/v3\/meta\/orgs\/[^/]+\/(teams|workflows|interfaces|dashboards|documents|agents|usage|plans|seats|audit|billing|integrations|connections|domains|sso-clients|workspaces)\/[^/]+/,
  /^\/api\/v3\/meta\/orgs\/[^/]+\/(teams|workflows|interfaces|dashboards|documents|agents|usage|plans|seats|audit|billing|integrations|connections|domains|sso-clients|workspaces)\/[^/]+\/[^/]+/,
  // /api/v3/meta/bases/:baseId/dashboards/* sub-resources (widgets,
  // data, share, duplicate, permissions) that aren't part of the
  // DashboardsController CRUD. The CRUD itself is handled by
  // DashboardsController (registered in NocoModule) and falls through
  // here only when the controller returns null or for these
  // sub-paths.
  /^\/api\/v3\/meta\/bases\/[^/]+\/dashboards\/[^/]+\/(widgets|data|share|duplicate|permissions)/,
  /^\/api\/v3\/meta\/bases\/[^/]+\/dashboards\/[^/]+\/widgets\/[^/]+/,
  /^\/api\/v3\/meta\/bases\/[^/]+\/dashboards\/[^/]+\/widgets\/[^/]+\/data/,
];

function isEeStubPathV3(path: string): boolean {
  return EE_STUB_PATTERNS_V3.some((re) => re.test(path));
}

function pickEeStubBodyV3(path: string, method: string): any {
  const isWrite = ['POST', 'PATCH', 'DELETE', 'PUT'].includes(method);
  if (isWrite) return { success: true };
  return { list: [] };
}

@Controller()
export class NotFoundV3Controller {
  @All(NOT_FOUND_PATH_PREFIX)
  @HttpCode(404)
  async notFoundV3(
    @Req() req: NcRequest,
    @Res() res: Response,
  ) {
    // CE local-dev fallback: see ApiVersionNotFoundController. Bypass
    // the @HttpCode(404) decorator on the happy path by writing the
    // response directly via the injected Res object.
    if (isEeStubPathV3(req.path)) {
      return res.status(200).json(pickEeStubBodyV3(req.path, req.method));
    }
    return {
      error: 'NOT_FOUND',
      message: `Cannot ${req.method} ${req.path}`,
    };
  }
}
