import { All, Controller, HttpCode, Req, Res } from '@nestjs/common';
import type { Response } from 'express';
import { NcRequest } from 'nocodb-sdk';
import { NcError } from 'src/helpers/catchError';

const V1_PATH_PREFIX = '/api/v1/*';
const V2_PATH_PREFIX = '/api/v2/*';
const NOT_FOUND_PATH_PREFIX = '/api/v:apiVersion(\\d+)/*';

// CE local-dev shim: the EE-flavored frontend probes a long tail of
// paid-feature paths (snapshots, AI, integrations, extensions, etc.)
// that have no implementation in the open-source build. Express route
// matching resolves specific paths first and falls back to the
// `/api/v2/*` wildcard only when nothing else matches — so this
// controller catches every unhandled sub-path under /api/v1 and
// /api/v2 and gets the last word.
//
// We match known EE path patterns here and return empty shapes
// (status 200) instead of the default 404. Real unknown paths still
// fall through to `NcError.notFound` for a clean 404 response.
const EE_STUB_PATTERNS: RegExp[] = [
  // /api/v2/meta/bases/:baseId/{snapshots,snapshot-schedule,audits}
  /^\/api\/v2\/meta\/bases\/[^/]+\/(snapshots|snapshot-schedule|audits)(\/[^/]+)?$/,
  /^\/api\/v2\/meta\/audits$/,
  // /api/v2/ai/*
  /^\/api\/v2\/ai\//,
  // /api/v2/cloud-features, /api/v2/feed
  /^\/api\/v2\/(cloud-features|feed)$/,
  // /api/v2/integrations + variants (read GETs that have no CE route)
  /^\/api\/v2\/integrations\/[^/]+$/,
  // /api/v2/extensions (bare — list shape)
  /^\/api\/v2\/extensions$/,
  // /api/v2/domains + variants
  /^\/api\/v2\/domains(\/[^/]+)?(\/[^/]+)?$/,
  // /api/v2/orgs/:orgId/{sso-clients,domains}
  /^\/api\/v2\/orgs\/[^/]+\/(sso-clients|sso-clients\/[^/]+|domains)/,
  // /api/v2/workspaces/:id/{sso-clients,domains}
  /^\/api\/v2\/workspaces\/[^/]+\/(sso-clients|sso-clients\/[^/]+|domains)/,
  // /api/v2/sso, /api/v2/oauth/authorize
  /^\/api\/v2\/sso$/,
  /^\/api\/v2\/oauth\/authorize$/,
  // /api/v2/jobs/:jobId
  /^\/api\/v2\/jobs\/[^/]+$/,
  // /api/v2/export/:baseId[/...]
  /^\/api\/v2\/export\/[^/]+(\/[^/]+)?$/,
  // /api/v2/public/shared-dashboard/*
  /^\/api\/v2\/public\/shared-dashboard\//,
  // /api/v2/meta/orgs/:orgId/{workflows,interfaces,dashboards,...}
  /^\/api\/v2\/meta\/orgs\/[^/]+\/(workflows|interfaces|dashboards|documents|agents|teams|usage|plans|seats|audit|billing)/,
  // /api/v1/* EE-flavored endpoints
  /^\/api\/v1\/(license|aggregated-meta-info)$/,
  /^\/api\/v1\/(notifications|notifications\/[^/]+|notifications\/mark-all-read|notifications\/poll)$/,
  /^\/api\/v1\/(url_to_config|error-reporting|app-settings|command_palette)$/,
  /^\/api\/v1\/cowriter\//,
  // /api/v3/meta/orgs/:orgId/* (skills catalog, policy, etc.)
  /^\/api\/v3\/meta\/orgs\/[^/]+\/skills\/[^/]+$/,
  /^\/api\/v3\/meta\/orgs\/[^/]+\/skills\/(catalog|policy)/,
  /^\/api\/v3\/meta\/orgs\/[^/]+\/skill-polic(y|ies)/,
  /^\/api\/v3\/meta\/orgs\/[^/]+\/skills\/[^/]+\/[^/]+$/,
];

function isEeStubPath(path: string): boolean {
  return EE_STUB_PATTERNS.some((re) => re.test(path));
}

function pickEeStubBody(path: string, method: string): any {
  const isWrite = ['POST', 'PATCH', 'DELETE', 'PUT'].includes(method);
  if (isWrite) return { success: true };
  if (path.includes('/jobs/')) return { status: 'completed', progress: 100 };
  if (
    path.startsWith('/api/v2/ai/') ||
    path === '/api/v2/sso' ||
    path === '/api/v2/oauth/authorize' ||
    path.startsWith('/api/v1/cowriter/')
  ) {
    return {};
  }
  return { list: [] };
}

@Controller()
export class ApiVersionNotFoundController {
  @All([V1_PATH_PREFIX, V2_PATH_PREFIX])
  @HttpCode(404)
  async apiVersion1And2NotFound(
    @Req() req: NcRequest,
    @Res() res: Response,
  ) {
    // CE local-dev fallback: if the request matched an EE-only path
    // pattern we know about, return an empty shape (status 200) so the
    // patched UI doesn't see 404 errors in console. We bypass NestJS's
    // automatic JSON serialization here so the @HttpCode(404) decorator
    // doesn't force the status down on the happy path.
    if (isEeStubPath(req.path)) {
      return res.status(200).json(pickEeStubBody(req.path, req.method));
    }
    NcError.notFound(`Cannot ${req.method} ${req.path}`);
  }

  @All(NOT_FOUND_PATH_PREFIX)
  @HttpCode(404)
  async apiVersionNotFound() {
    return {
      error: 'INVALID_API_VERSION',
      message: `API version unsupported`,
    };
  }
}
