import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'
import * as React from 'npm:react@18.3.1'

interface ConfirmationEmailProps {
  confirmationUrl: string
}

export const ConfirmationEmail = ({
  confirmationUrl,
}: ConfirmationEmailProps) => (
  <Html>
    <Head />
    <Preview>Confirmez votre inscription à Fitpas</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Confirmez votre inscription à Fitpas</Heading>
        <Text style={text}>
          Bienvenue sur Fitpas ! Nous sommes ravis de vous compter parmi nous.
        </Text>
        <Text style={text}>
          Cliquez sur le lien ci-dessous pour confirmer votre adresse email et activer votre compte :
        </Text>
        <Link
          href={confirmationUrl}
          target="_blank"
          style={button}
        >
          Confirmer mon email
        </Link>
        <Text style={text}>
          Si vous n'avez pas créé de compte Fitpas, vous pouvez ignorer cet email en toute sécurité.
        </Text>
        <Text style={footer}>
          Cordialement,<br />
          L'équipe Fitpas<br />
          <br />
          FitPaS<br />
          Place de la Gare 10<br />
          1003 Lausanne<br />
          Suisse
        </Text>
        <Text style={footerContact}>
          Contact : <Link href="mailto:support@fitpas.app" style={link}>support@fitpas.app</Link>
        </Text>
      </Container>
    </Body>
  </Html>
)

export default ConfirmationEmail

const main = {
  backgroundColor: '#f6f9fc',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif',
}

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '20px 0 48px',
  marginBottom: '64px',
  maxWidth: '600px',
}

const h1 = {
  color: '#333',
  fontSize: '24px',
  fontWeight: 'bold',
  margin: '40px 0',
  padding: '0 48px',
  textAlign: 'center' as const,
}

const text = {
  color: '#333',
  fontSize: '16px',
  lineHeight: '26px',
  margin: '16px 0',
  padding: '0 48px',
}

const button = {
  backgroundColor: '#5469d4',
  borderRadius: '5px',
  color: '#fff',
  display: 'block',
  fontSize: '16px',
  fontWeight: 'bold',
  textAlign: 'center' as const,
  textDecoration: 'none',
  padding: '12px 20px',
  margin: '32px 48px',
}

const link = {
  color: '#5469d4',
  textDecoration: 'underline',
}

const footer = {
  color: '#8898aa',
  fontSize: '14px',
  lineHeight: '22px',
  margin: '32px 0 0 0',
  padding: '0 48px',
}

const footerContact = {
  color: '#8898aa',
  fontSize: '14px',
  lineHeight: '22px',
  margin: '8px 0',
  padding: '0 48px',
}
