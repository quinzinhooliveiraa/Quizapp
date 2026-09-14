# 101 — prompt: páginas de Termos e Privacidade + footer

> ⚠️ **Eu não sou advogado.** Isto é um ponto de partida sério, escrito a partir
> do que o teu código realmente coleta e envia, mas não substitui revisão
> jurídica — ainda mais porque você vende para Portugal, onde vale o RGPD e o
> direito de livre resolução é diferente do brasileiro (ver nota no fim).

---

## ANTES DE COLAR: 4 dados que só você tem

Substitua em todos os lugares marcados:

- `Perguntas de Conexão` — seu nome completo ou o da empresa
- `57.412.420/0001-00` — obrigatório pelo CDC art. 31
- `Belo Horizonte, MG` — endereço completo (pode ser o do MEI/empresa)
- `perguntasdeconexao@gmail.com` — o e-mail de suporte que você realmente lê

Sem os quatro, a página não cumpre a exigência de identificação do fornecedor —
que é justamente o que a Meta e o Google checam antes de aprovar conta de
anúncio.

---

## PARTE 1 — criar `src/pages/Termos.tsx`

```tsx
export default function Termos() {
  return (
    <main className="legal-page">
      <div className="legal-container">
        <h1>Termos de Uso</h1>
        <p className="legal-updated">Última atualização: 14 de setembro de 2026</p>

        <h2>1. Quem somos</h2>
        <p>
          O Perguntas de Conexão é operado por Perguntas de Conexão, inscrito(a)
          no CPF/CNPJ sob nº 57.412.420/0001-00, com endereço em Belo Horizonte, MG. Contato:{" "}
          <a href="mailto:perguntasdeconexao@gmail.com">perguntasdeconexao@gmail.com</a>.
        </p>

        <h2>2. O que você está comprando</h2>
        <p>
          Uma licença de acesso vitalício, pessoal e intransferível, a um baralho
          digital de perguntas para casais, hoje com 459 perguntas distribuídas em
          15 baralhos temáticos mais um baralho do dia. O acesso é para duas
          pessoas: você e uma pessoa convidada por você, através do link de
          convite gerado após a compra.
        </p>
        <p>
          "Vitalício" significa enquanto o serviço existir e for operado por nós.
          Novos baralhos lançados depois da sua compra ficam incluídos, sem custo
          adicional. Não nos comprometemos com uma quantidade mínima de baralhos
          novos por período.
        </p>

        <h2>3. Preço, pagamento e acesso</h2>
        <p>
          O preço é o exibido na página no momento da compra, em pagamento único,
          sem mensalidade. O pagamento é processado por parceiros: cartão de
          crédito pela Stripe e Pix pela Abacate Pay. Não recebemos nem
          armazenamos os dados do seu cartão.
        </p>
        <p>
          O acesso é liberado automaticamente assim que a confirmação do pagamento
          chega, e você recebe um e-mail com o link de acesso.
        </p>

        <h2>4. Devolução e direito de arrependimento</h2>
        <p>
          <strong>Garantia de 7 dias:</strong> se não fizer sentido para vocês,
          devolvemos 100% do valor dentro de 7 dias a contar da compra. Basta
          escrever para perguntasdeconexao@gmail.com pedindo o reembolso — não pedimos
          justificativa.
        </p>
        <p>
          <strong>Clientes no Brasil:</strong> além dessa garantia, você tem o
          direito de arrependimento previsto no art. 49 do Código de Defesa do
          Consumidor, de 7 dias corridos a contar da contratação.
        </p>
        <p>
          <strong>Clientes em Portugal e na União Europeia:</strong> você tem
          direito de livre resolução de 14 dias. Como se trata de conteúdo digital
          de acesso imediato, ao concluir a compra você concorda que a execução
          comece na hora. Ainda assim, mantemos os 14 dias para pedidos de
          reembolso vindos da União Europeia.
        </p>
        <p>
          Reembolsos são feitos pelo mesmo meio de pagamento usado na compra, em
          até 14 dias após o pedido.
        </p>

        <h2>5. Conteúdo adulto</h2>
        <p>
          O produto é destinado a maiores de 18 anos. Três baralhos — Luzes
          Baixas, Fogo Alto e Sem Freio — contêm perguntas de teor sexual e estão
          sinalizados com 18+ dentro do produto. Ao comprar, você declara ter 18
          anos ou mais.
        </p>

        <h2>6. O que isto não é</h2>
        <p>
          O Perguntas de Conexão é um produto de entretenimento e conversa. Não é
          terapia, não é acompanhamento psicológico e não substitui apoio
          profissional. Se a sua relação está passando por uma situação que pede
          ajuda especializada, procure um profissional.
        </p>

        <h2>7. Uso permitido</h2>
        <p>
          As perguntas, textos, marca e materiais do produto são de nossa
          propriedade. Você pode usá-los livremente com a pessoa convidada, no
          contexto pessoal. Não é permitido revender, redistribuir, publicar as
          perguntas como conteúdo próprio, nem compartilhar o acesso além do
          convite único previsto.
        </p>
        <p>
          Podemos suspender o acesso em caso de compartilhamento em massa,
          revenda, tentativa de fraude no pagamento ou uso que prejudique o
          funcionamento do serviço.
        </p>

        <h2>8. Disponibilidade</h2>
        <p>
          Trabalhamos para manter o serviço no ar, mas ele pode ficar
          indisponível por manutenção, falha técnica ou motivo fora do nosso
          controle. Não nos responsabilizamos por indisponibilidades temporárias.
        </p>

        <h2>9. Mudanças nestes termos</h2>
        <p>
          Podemos atualizar estes termos. A data no topo indica a última versão.
          Mudanças relevantes serão comunicadas por e-mail a quem já comprou.
        </p>

        <h2>10. Lei aplicável</h2>
        <p>
          Estes termos são regidos pela lei brasileira. Fica eleito o foro do
          domicílio do consumidor para dirimir eventuais conflitos, conforme o
          Código de Defesa do Consumidor. Consumidores residentes na União
          Europeia mantêm as proteções da legislação do seu país de residência.
        </p>
      </div>
    </main>
  );
}
```

---

## PARTE 2 — criar `src/pages/Privacidade.tsx`

```tsx
export default function Privacidade() {
  return (
    <main className="legal-page">
      <div className="legal-container">
        <h1>Política de Privacidade</h1>
        <p className="legal-updated">Última atualização: 14 de setembro de 2026</p>

        <h2>1. Quem trata os seus dados</h2>
        <p>
          Perguntas de Conexão, CPF/CNPJ 57.412.420/0001-00, endereço Belo Horizonte, MG. Para
          qualquer assunto relacionado a dados pessoais, incluindo os pedidos
          descritos no item 7, escreva para{" "}
          <a href="mailto:perguntasdeconexao@gmail.com">perguntasdeconexao@gmail.com</a>.
        </p>

        <h2>2. Quais dados coletamos</h2>
        <p>
          <strong>Quando você compra:</strong> nome e e-mail. Os dados de
          pagamento (cartão, dados bancários) são coletados e processados
          diretamente pela Stripe e pela Abacate Pay — nós não os recebemos nem
          armazenamos.
        </p>
        <p>
          <strong>Quando você faz o teste ou usa o produto:</strong> as respostas
          que você dá no quiz, incluindo o tipo de relacionamento que você
          informa, e as perguntas que você marca como favoritas ou pula. Se você
          convidar alguém, o nome e o e-mail dessa pessoa.
        </p>
        <p>
          <strong>Quando você navega:</strong> um identificador aleatório de
          visitante, as páginas e seções que você visita, os botões que você
          clica e o tempo de permanência. Isso serve para entender o que funciona
          na página. Não usamos pixel de rede social nem ferramenta de
          publicidade de terceiros.
        </p>

        <h2>3. Para que usamos</h2>
        <p>
          Para liberar e manter o seu acesso, enviar o código de login e o e-mail
          de confirmação da compra, dar suporte quando você escreve, cumprir
          obrigações fiscais e legais, e melhorar a página e o produto com base
          em dados agregados de navegação.
        </p>
        <p>
          <strong>Bases legais:</strong> execução do contrato (liberar o acesso
          que você comprou), cumprimento de obrigação legal (guarda fiscal) e
          legítimo interesse (segurança e melhoria do serviço), nos termos do art.
          7º da LGPD e do art. 6º do RGPD.
        </p>

        <h2>4. Com quem compartilhamos</h2>
        <p>
          Só com os parceiros necessários para o serviço funcionar, e apenas o
          necessário:
        </p>
        <ul>
          <li>
            <strong>Stripe</strong> — processamento de pagamento com cartão.
          </li>
          <li>
            <strong>Abacate Pay</strong> — processamento de pagamento por Pix.
          </li>
          <li>
            <strong>Brevo</strong> — envio dos e-mails de acesso e de código de
            login.
          </li>
          <li>
            <strong>Railway</strong> — hospedagem do servidor e do banco de dados.
          </li>
        </ul>
        <p>
          Não vendemos, alugamos nem cedemos os seus dados para terceiros com
          finalidade publicitária.
        </p>

        <h2>5. Transferência internacional</h2>
        <p>
          Alguns desses parceiros processam dados fora do Brasil e fora da União
          Europeia. Eles operam sob cláusulas contratuais padrão e mecanismos de
          adequação previstos na LGPD e no RGPD.
        </p>

        <h2>6. Cookies e armazenamento local</h2>
        <p>
          Usamos apenas o necessário para o site funcionar. Não usamos cookies de
          publicidade.
        </p>
        <ul>
          <li>
            <strong>Região de preço</strong> — guarda se você deve ver preços em
            reais ou em euros. Dura 180 dias.
          </li>
          <li>
            <strong>Identificador de visitante</strong> — um código aleatório que
            nos permite medir a navegação e manter você na mesma versão da página
            entre visitas. Não identifica você pessoalmente.
          </li>
          <li>
            <strong>Armazenamento local do navegador</strong> — guarda o seu
            progresso no produto e preferências de uso, no seu próprio aparelho.
          </li>
        </ul>

        <h2>7. Seus direitos</h2>
        <p>
          Você pode pedir, a qualquer momento: confirmação de que tratamos seus
          dados, acesso aos dados, correção, anonimização ou eliminação, cópia em
          formato portável, informação sobre com quem compartilhamos, e revogação
          de consentimento. Basta escrever para perguntasdeconexao@gmail.com — respondemos
          em até 15 dias.
        </p>
        <p>
          Se você estiver na União Europeia, tem também o direito de apresentar
          reclamação à autoridade de proteção de dados do seu país. No Brasil, a
          autoridade é a ANPD.
        </p>

        <h2>8. Por quanto tempo guardamos</h2>
        <p>
          Dados de conta e de acesso enquanto a sua conta existir, já que o acesso
          é vitalício. Registros de compra pelo prazo exigido pela legislação
          fiscal. Dados de navegação por até 24 meses. Depois disso, apagamos ou
          anonimizamos.
        </p>

        <h2>9. Menores de idade</h2>
        <p>
          O produto é destinado a maiores de 18 anos e não coletamos dados de
          menores intencionalmente. Se identificarmos um cadastro de menor,
          apagaremos os dados.
        </p>

        <h2>10. Mudanças nesta política</h2>
        <p>
          Podemos atualizar esta política. A data no topo indica a última versão.
        </p>
      </div>
    </main>
  );
}
```

---

## PARTE 3 — rotas

Em `App.tsx`, dentro do `<Switch>` do `Router()`, antes do
`<Route component={NotFound} />`, adicionar:

```tsx
          <Route path="/termos" component={Termos} />
          <Route path="/privacidade" component={Privacidade} />
```

E os imports no topo, seguindo o mesmo padrão de lazy loading das outras
páginas (`Login`, `Play`, `Admin`).

---

## PARTE 4 — footer (não existe hoje)

A LP1 não tem footer, então não há onde colocar os links nem a identificação do
vendedor. Criar um, no fim da `LandingV2Quiz`, depois da seção de FAQ e antes
do fechamento:

```tsx
      <footer className="lp-footer">
        <div className="lp-container">
          <p className="lp-footer-brand">Perguntas de Conexão</p>
          <p className="lp-footer-legal">
            Perguntas de Conexão · CNPJ 57.412.420/0001-00
          </p>
          <nav className="lp-footer-links">
            <a href="/termos">Termos de uso</a>
            <a href="/privacidade">Privacidade</a>
            <a href="mailto:perguntasdeconexao@gmail.com">Contato</a>
          </nav>
        </div>
      </footer>
```

CSS, no `index.css`:

```css
.lp-footer {
  padding: 2.5rem 0 3rem;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  text-align: center;
}
.lp-footer-brand {
  margin: 0 0 0.4rem;
  color: rgba(249, 248, 251, 0.8);
  font-size: 0.9rem;
  font-weight: 600;
}
.lp-footer-legal {
  margin: 0 0 1rem;
  color: rgba(249, 248, 251, 0.45);
  font-size: 0.75rem;
}
.lp-footer-links {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 1.2rem;
}
.lp-footer-links a {
  color: rgba(249, 248, 251, 0.6);
  font-size: 0.78rem;
  text-decoration: underline;
  text-underline-offset: 3px;
}
.lp-footer-links a:hover {
  color: var(--lp1-accent);
}
```

CSS das páginas legais:

```css
.legal-page {
  min-height: 100vh;
  padding: 3rem 1rem 5rem;
  background: #14101c;
  color: rgba(249, 248, 251, 0.82);
}
.legal-container {
  max-width: 720px;
  margin: 0 auto;
  line-height: 1.7;
}
.legal-container h1 {
  margin: 0 0 0.3rem;
  color: #f9f8fb;
  font-size: 1.8rem;
}
.legal-updated {
  margin: 0 0 2.5rem;
  color: rgba(249, 248, 251, 0.45);
  font-size: 0.82rem;
}
.legal-container h2 {
  margin: 2.2rem 0 0.7rem;
  color: #f9f8fb;
  font-size: 1.05rem;
}
.legal-container p,
.legal-container li {
  font-size: 0.92rem;
}
.legal-container ul {
  padding-left: 1.2rem;
}
.legal-container li {
  margin-bottom: 0.5rem;
}
.legal-container a {
  color: var(--lp1-accent, #e8b13a);
}
```

---

## Uma coisa para conferir


---

## 3. Razão social × nome fantasia

Confirme no cartão do CNPJ se "Perguntas de Conexão" é a **razão social**. Em
MEI e empresas pequenas ela costuma ser o nome da pessoa seguido do número. Se
for esse o caso, troque para a razão social e cite o nome fantasia junto, assim:

```
Razão Social Registrada Ltda, que opera sob o nome Perguntas de Conexão
```

A identificação precisa bater com o registro para valer.
