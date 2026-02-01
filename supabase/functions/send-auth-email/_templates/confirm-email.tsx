import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from 'https://esm.sh/@react-email/components@0.0.22?target=es2022'
import * as React from 'https://esm.sh/react@18.2.0?target=es2022'

interface ConfirmEmailProps {
  userName?: string
  confirmUrl: string
}

export const ConfirmEmailTemplate = ({
  userName,
  confirmUrl,
}: ConfirmEmailProps) => {
  const greeting = userName ? `Olá, ${userName}!` : 'Olá!'

  return (
    <Html>
      <Head />
      <Preview>Confirme seu e-mail para acessar a plataforma Ideart</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Heading style={logo}>Ideart</Heading>
          </Section>

          <Section style={content}>
            <Heading style={h1}>Confirme seu e-mail</Heading>

            <Text style={paragraph}>{greeting}</Text>

            <Text style={paragraph}>
              Obrigado por se cadastrar na plataforma Ideart. Para concluir seu
              cadastro e acessar sua conta, confirme seu endereço de e-mail
              clicando no botão abaixo.
            </Text>

            <Section style={buttonContainer}>
              <Button style={button} href={confirmUrl}>
                Confirmar E-mail
              </Button>
            </Section>

            <Text style={paragraph}>
              Se você não criou uma conta na Ideart, pode ignorar este e-mail
              com segurança.
            </Text>

            <Text style={footerNote}>Este link expira em 24 horas.</Text>
          </Section>

          <Section style={footer}>
            <Text style={footerText}>
              © {new Date().getFullYear()} Ideart. Todos os direitos reservados.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export default ConfirmEmailTemplate

const main = {
  backgroundColor: '#f6f9fc',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Ubuntu, sans-serif',
}

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '0',
  maxWidth: '600px',
  borderRadius: '8px',
  overflow: 'hidden' as const,
  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.07)',
}

const header = {
  backgroundColor: '#6366f1',
  padding: '32px 40px',
  textAlign: 'center' as const,
}

const logo = {
  color: '#ffffff',
  fontSize: '28px',
  fontWeight: '700',
  margin: '0',
  letterSpacing: '-0.5px',
}

const content = {
  padding: '40px',
}

const h1 = {
  color: '#1f2937',
  fontSize: '24px',
  fontWeight: '600',
  lineHeight: '1.25',
  margin: '0 0 24px',
}

const paragraph = {
  color: '#4b5563',
  fontSize: '16px',
  lineHeight: '1.6',
  margin: '0 0 20px',
}

const buttonContainer = {
  textAlign: 'center' as const,
  margin: '32px 0',
}

const button = {
  backgroundColor: '#6366f1',
  borderRadius: '6px',
  color: '#ffffff',
  fontSize: '16px',
  fontWeight: '600',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '14px 32px',
}

const footerNote = {
  color: '#9ca3af',
  fontSize: '14px',
  margin: '24px 0 0',
  textAlign: 'center' as const,
}

const footer = {
  backgroundColor: '#f9fafb',
  padding: '24px 40px',
  textAlign: 'center' as const,
}

const footerText = {
  color: '#9ca3af',
  fontSize: '13px',
  margin: '0',
}
