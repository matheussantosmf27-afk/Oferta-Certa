-- Teste das funções da migration 005 (cole no SQL Editor e execute).
-- É um único bloco: termina SEMPRE com exceção, o que desfaz a transação inteira — nenhum dado fica gravado.
--   Sucesso: ERROR "TESTES_OK (abortado de propósito para desfazer tudo)"
--   Falha:   ERROR "FALHOU: <caso>"

do $$
declare
  v_market uuid := (select id from public.marketplaces where slug = 'mercado-livre');
  v_cat uuid := (select id from public.categories order by name limit 1);
  v_run uuid;
  v_other_run uuid;
  v_product uuid;
  v_status public.product_status;
  v_failed boolean;
  r record;
  url_ok text := 'https://www.mercadolivre.com.br/p/MLBTEST1?matt_word=teste_tag&matt_tool=123456';

begin
  insert into public.radar_runs (trigger, status, finished_at) values ('teste', 'success', now()) returning id into v_run;
  insert into public.radar_runs (trigger, status, finished_at) values ('teste', 'success', now()) returning id into v_other_run;

  update public.automation_settings
     set auto_publish_enabled = true, auto_publish_min_score = 40, auto_publish_max_per_run = 2, auto_publish_max_per_day = 100,
         ml_matt_word = 'teste_tag', ml_matt_tool = '123456'
   where id;

  insert into public.candidate_products (marketplace_id, external_id, title, permalink, image_url, price, original_price,
    suggested_category_id, score, score_breakdown, last_run_id)
  values
    (v_market, 'MLBTEST1', 'Teste elegível', 'https://www.mercadolivre.com.br/p/MLBTEST1', 'https://http2.mlstatic.com/a.jpg', 100, 150, v_cat, 55, '{}', v_run),
    (v_market, 'MLBTEST2', 'Teste suspeito', 'https://www.mercadolivre.com.br/p/MLBTEST2', 'https://http2.mlstatic.com/a.jpg', 100, 900, v_cat, 60, '{"_alertas":["desconto_suspeito"]}', v_run),
    (v_market, 'MLBTEST3', 'Teste score 40', 'https://www.mercadolivre.com.br/p/MLBTEST3', 'https://http2.mlstatic.com/a.jpg', 100, null, v_cat, 40, '{}', v_run),
    (v_market, 'MLBTEST4', 'Teste outra coleta', 'https://www.mercadolivre.com.br/p/MLBTEST4', 'https://http2.mlstatic.com/a.jpg', 100, null, v_cat, 70, '{}', v_other_run),
    (v_market, 'MLBTEST5', 'Teste sem imagem', 'https://www.mercadolivre.com.br/p/MLBTEST5', null, 100, null, v_cat, 70, '{}', v_run),
    (v_market, 'MLBTEST6', 'Teste sem categoria', 'https://www.mercadolivre.com.br/p/MLBTEST6', 'https://http2.mlstatic.com/a.jpg', 100, null, null, 70, '{}', v_run),
    (v_market, 'MLBTEST7', 'Teste elegível 2', 'https://www.mercadolivre.com.br/p/MLBTEST7', 'https://http2.mlstatic.com/a.jpg', 100, null, v_cat, 70, '{}', v_run),
    (v_market, 'MLBTEST8', 'Teste elegível 3', 'https://www.mercadolivre.com.br/p/MLBTEST8', 'https://http2.mlstatic.com/a.jpg', 100, null, v_cat, 70, '{}', v_run);

  -- Permissões: só service_role executa a variante interna; núcleo não é exposto.
  if has_function_privilege('anon', 'public.publish_candidate_internal(uuid,text,uuid)', 'execute')
     or has_function_privilege('authenticated', 'public.publish_candidate_internal(uuid,text,uuid)', 'execute') then
    raise exception 'FALHOU: publish_candidate_internal exposta a anon/authenticated';
  end if;
  if not has_function_privilege('service_role', 'public.publish_candidate_internal(uuid,text,uuid)', 'execute') then
    raise exception 'FALHOU: service_role sem acesso a publish_candidate_internal';
  end if;
  if has_function_privilege('authenticated', 'public.publish_candidate_core(uuid,text,uuid,text,text,uuid,uuid)', 'execute')
     or has_function_privilege('anon', 'public.radar_refresh_products(jsonb)', 'execute')
     or has_function_privilege('anon', 'public.unpublish_products(uuid[],uuid)', 'execute') then
    raise exception 'FALHOU: função interna exposta';
  end if;

  -- Casos que devem ser recusados.
  for r in
    select * from (values
      ('MLBTEST1', 'https://www.mercadolivre.com.br/p/MLBTEST1', 'permalink puro'),
      ('MLBTEST1', 'https://www.mercadolivre.com.br/p/MLBTEST1?matt_word=outra&matt_tool=123456', 'etiqueta errada'),
      ('MLBTEST1', 'https://www.mercadolivre.com.br/p/MLBTEST1?matt_word=teste_tagX&matt_tool=123456', 'etiqueta com sufixo'),
      ('MLBTEST1', 'https://golpe.example.com/p?matt_word=teste_tag&matt_tool=123456', 'domínio fora da lista'),
      ('MLBTEST1', 'http://www.mercadolivre.com.br/p/MLBTEST1?matt_word=teste_tag&matt_tool=123456', 'sem https'),
      ('MLBTEST2', 'https://www.mercadolivre.com.br/p/MLBTEST2?matt_word=teste_tag&matt_tool=123456', 'desconto suspeito'),
      ('MLBTEST3', 'https://www.mercadolivre.com.br/p/MLBTEST3?matt_word=teste_tag&matt_tool=123456', 'score igual ao mínimo'),
      ('MLBTEST4', 'https://www.mercadolivre.com.br/p/MLBTEST4?matt_word=teste_tag&matt_tool=123456', 'vendedor não confirmado nesta coleta'),
      ('MLBTEST5', 'https://www.mercadolivre.com.br/p/MLBTEST5?matt_word=teste_tag&matt_tool=123456', 'sem imagem'),
      ('MLBTEST6', 'https://www.mercadolivre.com.br/p/MLBTEST6?matt_word=teste_tag&matt_tool=123456', 'sem categoria')
    ) as t(ext, url, caso)
  loop
    v_failed := false;
    begin
      perform public.publish_candidate_internal((select id from public.candidate_products where external_id = r.ext), r.url, v_run);
    exception when others then
      v_failed := true;
    end;
    if not v_failed then
      raise exception 'FALHOU: aceitou caso "%"', r.caso;
    end if;
  end loop;

  -- Caso válido.
  v_product := public.publish_candidate_internal((select id from public.candidate_products where external_id = 'MLBTEST1'), url_ok, v_run);
  if not exists (
    select 1 from public.products
    where id = v_product and status = 'active' and publish_mode = 'auto' and published_by is null
      and published_run_id = v_run and affiliate_url = url_ok and old_price = 150 and current_price = 100
  ) then
    raise exception 'FALHOU: produto automático gravado incorretamente';
  end if;
  if not exists (
    select 1 from public.candidate_products
    where external_id = 'MLBTEST1' and status = 'approved' and publish_mode = 'auto' and reviewed_by is null and product_id = v_product
  ) then
    raise exception 'FALHOU: candidato não marcado como publicado automaticamente';
  end if;

  -- Não publica duas vezes.
  v_failed := false;
  begin
    perform public.publish_candidate_internal((select id from public.candidate_products where external_id = 'MLBTEST1'), url_ok, v_run);
  exception when others then v_failed := true; end;
  if not v_failed then raise exception 'FALHOU: publicou o mesmo candidato duas vezes'; end if;

  -- Limite por execução (2): o segundo passa, o terceiro é recusado.
  perform public.publish_candidate_internal((select id from public.candidate_products where external_id = 'MLBTEST7'),
    'https://www.mercadolivre.com.br/p/MLBTEST7?matt_word=teste_tag&matt_tool=123456', v_run);
  v_failed := false;
  begin
    perform public.publish_candidate_internal((select id from public.candidate_products where external_id = 'MLBTEST8'),
      'https://www.mercadolivre.com.br/p/MLBTEST8?matt_word=teste_tag&matt_tool=123456', v_run);
  exception when others then v_failed := true; end;
  if not v_failed then raise exception 'FALHOU: limite por execução ignorado'; end if;

  -- Interruptor desligado bloqueia na hora.
  update public.automation_settings set auto_publish_max_per_run = 50, auto_publish_enabled = false where id;
  v_failed := false;
  begin
    perform public.publish_candidate_internal((select id from public.candidate_products where external_id = 'MLBTEST8'),
      'https://www.mercadolivre.com.br/p/MLBTEST8?matt_word=teste_tag&matt_tool=123456', v_run);
  exception when others then v_failed := true; end;
  if not v_failed then raise exception 'FALHOU: publicou com a automação desligada'; end if;

  -- Não dá para ligar sem etiqueta configurada.
  v_failed := false;
  begin
    update public.automation_settings set auto_publish_enabled = true, ml_matt_word = null where id;
  exception when check_violation then v_failed := true; end;
  if not v_failed then raise exception 'FALHOU: ligou a automação sem etiqueta'; end if;

  -- Expiração: 1ª ausência mantém ativo, 2ª seguida inativa.
  perform * from public.radar_refresh_products(jsonb_build_array(jsonb_build_object('product_id', v_product, 'available', false)));
  select status into v_status from public.products where id = v_product;
  if v_status <> 'active' then raise exception 'FALHOU: inativou na primeira ausência'; end if;

  -- Reaparecer zera o contador e atualiza o preço.
  perform * from public.radar_refresh_products(jsonb_build_array(jsonb_build_object(
    'product_id', v_product, 'available', true, 'price', 90, 'original_price', 80, 'free_shipping', true)));
  if not exists (select 1 from public.products where id = v_product and missing_offer_count = 0 and current_price = 90 and old_price is null) then
    raise exception 'FALHOU: atualização de preço/contador incorreta (preço anterior menor que o atual deve virar null)';
  end if;

  perform * from public.radar_refresh_products(jsonb_build_array(jsonb_build_object('product_id', v_product, 'available', false)));
  for r in select * from public.radar_refresh_products(jsonb_build_array(jsonb_build_object('product_id', v_product, 'available', false))) loop
    if r.expired <> 1 then raise exception 'FALHOU: contagem de expirados'; end if;
  end loop;
  if not exists (select 1 from public.products where id = v_product and status = 'inactive' and inactive_reason = 'sem_vendedor') then
    raise exception 'FALHOU: não inativou após duas ausências seguidas';
  end if;

  -- Despublicar exige admin.
  v_failed := false;
  begin
    perform public.unpublish_products(null, v_run);
  exception when insufficient_privilege then v_failed := true; end;
  if not v_failed then raise exception 'FALHOU: despublicou sem ser admin'; end if;

  raise exception 'TESTES_OK (abortado de propósito para desfazer tudo)';
end;
$$;
