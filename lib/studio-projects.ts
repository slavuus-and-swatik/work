import { randomBytes } from 'node:crypto';
import { presets, type Config, type PresetKey } from './shinslot';

export type StudioStatus = 'draft' | 'review' | 'approved' | 'revision_requested';
export type StudioProject = {
  id: string;
  clientName: string;
  clientEmail: string;
  references: string[];
  templateKey: PresetKey;
  config: Config;
  status: StudioStatus;
  reviewToken: string | null;
  reviewComment: string;
  createdAt: string;
  updatedAt: string;
};

const state = globalThis as typeof globalThis & { __studioProjects?: Map<string, StudioProject> };
const projects = state.__studioProjects ||= new Map<string, StudioProject>();

export function isPresetKey(value: unknown): value is PresetKey {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(presets, value);
}

export function createStudioProject(input: { clientName: string; clientEmail?: string; references: string[]; templateKey: PresetKey }) {
  const now = new Date().toISOString();
  const id = randomBytes(9).toString('base64url');
  const config = structuredClone(presets[input.templateKey]);
  const project: StudioProject = {
    id,
    clientName: input.clientName,
    clientEmail: input.clientEmail || '',
    references: input.references,
    templateKey: input.templateKey,
    config,
    status: 'draft',
    reviewToken: null,
    reviewComment: '',
    createdAt: now,
    updatedAt: now,
  };
  projects.set(id, project);
  return project;
}

export function getStudioProject(id: string) { return projects.get(id) || null; }
export function getStudioProjectByToken(token: string) {
  return [...projects.values()].find((project) => project.reviewToken === token) || null;
}
export function listStudioProjects() {
  return [...projects.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function sanitizeStudioConfig(config: Config) {
  const safe = structuredClone(config);
  safe.paymentMethods.yookassaSecretKey = undefined;
  safe.paymentMethods.tbankTerminalKey = undefined;
  return safe;
}

export function startStudioReview(project: StudioProject) {
  project.reviewToken ||= randomBytes(32).toString('base64url');
  project.status = 'review';
  project.reviewComment = '';
  project.updatedAt = new Date().toISOString();
  return project.reviewToken;
}
