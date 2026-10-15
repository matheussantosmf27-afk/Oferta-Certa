import type { Metadata } from 'next'
import { LegalPage } from '@/components/legal-page'

export const metadata: Metadata = {
  title: 'Termos de uso',
  description: 'Como o Oferta Certa funciona, links de afiliado e responsabilidades sobre preços e compras.',
  alternates: { canonical: '/termos' },
}

export default function TermsPage() {
  return (
    <LegalPage title="Termos de uso" updatedAt="14 de outubro de 2026">
      <section>
        <h2>O que é o Oferta Certa</h2>
        <p>
          Um site que reúne ofertas de lojas parceiras, como Mercado Livre, Shopee, AliExpress e Amazon. O Oferta Certa não vende, não entrega e não
          recebe pagamento por produtos: toda compra é feita diretamente na loja, sob as regras dela.
        </p>
      </section>

      <section>
        <h2>Links de afiliado</h2>
        <p>
          Muitos links do site são links de afiliado. Quando você compra por eles, a loja pode nos pagar uma comissão, sem
          nenhum custo extra para você. A comissão não altera o preço nem a ordem em que as ofertas aparecem.
        </p>
      </section>

      <section>
        <h2>Preços e disponibilidade</h2>
        <ul>
          <li>Os preços são conferidos automaticamente várias vezes ao dia, mas podem mudar a qualquer momento na loja.</li>
          <li>
            O desconto só é exibido quando o preço anterior informado pela loja é confirmado pelo nosso histórico ou é compatível com o que outros vendedores cobram. Não criamos descontos.
          </li>
          <li>Frete, estoque, prazos, garantia e trocas são definidos pela loja. Confira tudo antes de pagar.</li>
          <li>Descrições e fichas técnicas vêm do catálogo da loja; em caso de diferença, vale o que está na loja.</li>
        </ul>
      </section>

      <section>
        <h2>Sua conta</h2>
        <p>
          A conta é gratuita e serve para salvar favoritos. Você é responsável por manter sua senha em segurança. Podemos
          suspender contas usadas para abuso, como tentativas de invasão ou automação que prejudique o site.
        </p>
      </section>

      <section>
        <h2>Responsabilidade</h2>
        <p>
          Fazemos o possível para mostrar informações corretas, mas não garantimos que estejam livres de erro. Problemas
          com pedidos, entregas ou produtos devem ser resolvidos com a loja onde a compra foi feita.
        </p>
      </section>

      <section>
        <h2>Mudanças nestes termos</h2>
        <p>Podemos atualizar estes termos; a data no topo da página mostra a versão em vigor.</p>
      </section>
    </LegalPage>
  )
}
