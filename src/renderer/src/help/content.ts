import { buildHelp } from '@shared/help';
import changelog from '../../../../CHANGELOG.md?raw';

const files = import.meta.glob('../../../../help/*.md', {
  query: '?raw',
  import: 'default',
  eager: true
}) as Record<string, string>;

export const HELP_PAGES = buildHelp(files, changelog);
