'use client';

import NoAccess from '@/components/common/NoAccess';

/**
 * Where the middleware sends someone whose account this console does not
 * serve — kitchen staff, most often, who belong on the kitchen screen.
 */
export default function UnauthorizedPage() {
  return <NoAccess title="This console is not for your account" />;
}
