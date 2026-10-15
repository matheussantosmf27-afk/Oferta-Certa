import type { ReactNode } from 'react'
import { saveProduct } from '@/app/admin/actions'
import { SubmitButton } from '@/components/ui'
import type { Tables } from '@/types/supabase'

type Option = { id: string; name: string }

const input = 'mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm'

function Label({ text, children }: { text: string; children: ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="font-medium text-slate-700">{text}</span>
      {children}
    </label>
  )
}

export function ProductForm({
  product,
  categories,
  marketplaces,
}: {
  product?: Tables<'products'>
  categories: Option[]
  marketplaces: Option[]
}) {
  return (
    <form action={saveProduct} className="grid gap-4 rounded-lg border border-slate-200 bg-white p-5 sm:grid-cols-2">
      {product ? <input type="hidden" name="id" value={product.id} /> : null}
      <div className="sm:col-span-2">
        <Label text="Nome">
          <input name="name" required defaultValue={product?.name} className={input} />
        </Label>
      </div>
      <Label text="Slug (URL)">
        <input name="slug" defaultValue={product?.slug} placeholder="gerado a partir do nome" className={`${input} font-mono text-xs`} />
      </Label>
      <Label text="Marca">
        <input name="brand" defaultValue={product?.brand} className={input} />
      </Label>
      <Label text="Categoria">
        <select name="category_id" required defaultValue={product?.category_id ?? ''} className={input}>
          <option value="">Escolha…</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </Label>
      <Label text="Marketplace">
        <select name="marketplace_id" required defaultValue={product?.marketplace_id ?? ''} className={input}>
          <option value="">Escolha…</option>
          {marketplaces.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
      </Label>
      <Label text="Preço atual (R$)">
        <input name="current_price" type="number" step="0.01" min="0" required defaultValue={product?.current_price} className={input} />
      </Label>
      <Label text="Preço anterior (R$) — só se a loja informar">
        <input name="old_price" type="number" step="0.01" min="0" defaultValue={product?.old_price ?? ''} className={input} />
      </Label>
      <Label text="Parcelamento (texto)">
        <input name="installments" defaultValue={product?.installments ?? ''} placeholder="ex.: 10x de R$ 99,90 sem juros" className={input} />
      </Label>
      <Label text="Status">
        <select name="status" defaultValue={product?.status ?? 'draft'} className={input}>
          <option value="draft">Rascunho</option>
          <option value="active">Publicado</option>
          <option value="inactive">Inativo</option>
          <option value="expired">Expirado</option>
        </select>
      </Label>
      <div className="sm:col-span-2">
        <Label text="Seu link de afiliado">
          <input name="affiliate_url" type="url" defaultValue={product?.affiliate_url} placeholder="https://…" className={input} />
        </Label>
        <p className="mt-1 text-xs text-slate-500">
          Amazon: gere o link pela barra SiteStripe (logado na sua conta de Associado) e cole aqui. Sem a API da Amazon, o preço não é
          atualizado sozinho: o produto sai do site 7 dias após o último salvamento, a menos que você confira e salve de novo.
        </p>
        {product?.source_url ? (
          <a href={product.source_url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-xs text-brand-700 hover:underline">
            Página original do produto
          </a>
        ) : null}
      </div>
      <div className="sm:col-span-2">
        <Label text="Imagem (URL https)">
          <input name="image_url" type="url" defaultValue={product?.image_url} className={input} />
        </Label>
      </div>
      <div className="sm:col-span-2">
        <Label text="Resumo">
          <input name="short_description" defaultValue={product?.short_description} maxLength={200} className={input} />
        </Label>
      </div>
      <div className="sm:col-span-2">
        <Label text="Descrição">
          <textarea name="description" rows={5} defaultValue={product?.description} className={input} />
        </Label>
      </div>
      <div className="flex flex-wrap gap-6 text-sm text-slate-700 sm:col-span-2">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="free_shipping" defaultChecked={product?.free_shipping} /> Frete grátis
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="featured" defaultChecked={product?.featured} /> Destaque na home
        </label>
      </div>
      <div className="sm:col-span-2">
        <SubmitButton pendingText="Salvando…">Salvar produto</SubmitButton>
      </div>
    </form>
  )
}
