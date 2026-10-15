import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalPage } from '@/components/legal-page'

export const metadata: Metadata = {
  title: 'Política de privacidade',
  description: 'Quais dados o Oferta Certa coleta, para quê e como você controla essas informações.',
  alternates: { canonical: '/privacidade' },
}

export default function PrivacyPage() {
  return (
    <LegalPage title="Política de privacidade" updatedAt="14 de outubro de 2026">
      <p>
        O Oferta Certa mostra ofertas de lojas parceiras e leva você até a loja para concluir a compra. Esta página
        explica, de forma direta, quais dados tratamos, conforme a Lei Geral de Proteção de Dados (Lei 13.709/2018).
      </p>

      <section>
        <h2>O que coletamos</h2>
        <ul>
          <li>
            <strong>Conta (opcional):</strong> se você se cadastrar com e-mail, guardamos o e-mail e a senha protegida pelo
            nosso provedor de autenticação — não vemos a sua senha. Se entrar com o Google, recebemos apenas seu nome, e-mail
            e foto de perfil.
          </li>
          <li>
            <strong>Favoritos:</strong> os produtos que você salva. Sem conta, ficam só no seu navegador.
          </li>
          <li>
            <strong>Carrinho:</strong> fica apenas no seu navegador. Não enviamos o carrinho para os nossos servidores.
          </li>
          <li>
            <strong>Cliques em ofertas:</strong> quando você vai para uma loja, registramos o produto, o tipo de aparelho
            (celular, computador ou tablet), a página de origem e parâmetros de campanha (utm). Não guardamos seu
            endereço IP nem ligamos o clique à sua conta.
          </li>
          <li>
            <strong>Métricas de acesso:</strong> contamos visitas às páginas de forma agregada e sem cookies de
            rastreamento, para saber quais páginas são úteis.
          </li>
        </ul>
      </section>

      <section>
        <h2>Para que usamos</h2>
        <ul>
          <li>Permitir login, favoritos e a recuperação de senha.</li>
          <li>Entender quais ofertas interessam e melhorar a seleção de produtos.</li>
          <li>Manter o site seguro e funcionando.</li>
        </ul>
        <p className="mt-2">Não vendemos seus dados e não enviamos publicidade por e-mail sem o seu consentimento.</p>
      </section>

      <section>
        <h2>Cookies e armazenamento local</h2>
        <p>
          Usamos cookies apenas para manter você conectado à sua conta, e o armazenamento local do navegador para o
          carrinho e os favoritos de quem não tem conta. Ao chegar na loja parceira, valem os cookies e a política de
          privacidade dela — é assim que a loja identifica que a visita veio do Oferta Certa.
        </p>
      </section>

      <section>
        <h2>Com quem compartilhamos</h2>
        <ul>
          <li>Supabase, que hospeda o banco de dados e a autenticação.</li>
          <li>Vercel, que hospeda o site e mede as visitas de forma agregada.</li>
          <li>As lojas parceiras recebem a sua visita quando você clica em uma oferta, como em qualquer link.</li>
        </ul>
      </section>

      <section>
        <h2>Seus direitos</h2>
        <p>
          Você pode pedir acesso, correção ou exclusão dos seus dados e da sua conta a qualquer momento. Favoritos podem
          ser removidos direto na página de <Link href="/favoritos" className="font-medium text-brand-700 hover:underline">favoritos</Link>,
          e o carrinho e os favoritos locais somem ao limpar os dados do navegador.
        </p>
      </section>
    </LegalPage>
  )
}
