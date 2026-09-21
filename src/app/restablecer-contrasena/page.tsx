import type { Metadata } from 'next';
import { AuthShell } from '@/components/auth/auth-shell';
import { ResetForm } from './reset-form';

export const metadata: Metadata = { title: 'Restablecer contraseña' };

export default function RestablecerContrasenaPage() {
  return (
    <AuthShell titulo="Nueva contraseña" subtitulo="Ponle una contraseña nueva a tu cuenta.">
      <ResetForm />
    </AuthShell>
  );
}
