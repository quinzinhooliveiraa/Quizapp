type Lp3Testimonial = {
  quote: string;
  name: string;
  detail: string;
};

// These are the existing real landing-page testimonials, selected for LP3
// because they cover discovery, distance, and reconnection without added metadata.
const lp3Testimonials: Lp3Testimonial[] = [
  {
    quote: `No nosso aniversário de um ano, viajamos para uma cabana no interior. Foi aquele fim de semana perfeito: lugar tranquilo, banheira, vinho e o Perguntas de Conexão.

A gente chegava a passar 20 minutos em uma única pergunta, porque sempre acabava percebendo o quanto ainda não sabíamos um sobre o outro.

Até que apareceu uma pergunta: "Quando foi o momento em que você percebeu que estava apaixonado por mim?"

A resposta dele me pegou completamente de surpresa. Ele disse que foi quando eu falei que amava as cicatrizes dele, as de fora e as de dentro.

Nós dois ficamos emocionados.

Foi uma conversa simples, mas alguma coisa mudou naquele momento.

A gente continua usando até hoje. E já sei que vai estar com a gente no próximo aniversário também.`,
    name: "Caio",
    detail: "1 ano juntos",
  },
  {
    quote: `Eu e meu namorado nos conhecemos há 26 anos.

Na época, éramos grandes amigos. A vida levou cada um para um lado e, muitos anos depois, acabamos nos reencontrando.

Agora estamos vivendo um relacionamento à distância.

No começo, nossas chamadas eram basicamente colocar a conversa em dia. Mas depois de um tempo, percebemos que às vezes ficávamos sem assunto.

Foi quando começamos a usar algumas perguntas do Perguntas de Conexão durante nossas chamadas.

Hoje virou um ritual.

Toda noite, antes de desligar, escolhemos algumas perguntas. Às vezes são duas. Às vezes são cinco. Às vezes uma única pergunta ocupa a noite inteira.

Tem sido uma forma muito especial de diminuir a distância e continuar descobrindo quem somos hoje.

Porque mesmo depois de 26 anos, ainda existe muito para conhecer um no outro.`,
    name: "Fernanda",
    detail: "26 anos de história",
  },
  {
    quote: `Eu e meu marido compramos o Perguntas de Conexão para fazer alguma coisa diferente juntos.

Não esperávamos muita coisa.

Até aparecer a primeira pergunta realmente profunda.

Depois veio outra.

E outra.

Quando percebemos, estávamos falando sobre sentimentos que fazia muito tempo que não colocávamos em palavras.

Foi uma das melhores coisas que fizemos para a nossa relação.

Não parece que você está "jogando um jogo".

Parece que alguém finalmente te deu uma razão para parar tudo, sentar ao lado da pessoa que você ama e perguntar:

"Me conta uma coisa que eu ainda não sei sobre você."

Foi uma das melhores compras que já fizemos para o nosso relacionamento.`,
    name: "Marina",
    detail: "Uma reconexão",
  },
];

export function Lp3Testimonials() {
  return (
    <section className="lp3-testimonials" aria-labelledby="lp3-testimonials-title">
      <h2 id="lp3-testimonials-title" className="lp3-testimonials-title">
        Não fomos os únicos a perceber isso.
      </h2>
      <div className="lp3-testimonials-grid">
        {lp3Testimonials.map((testimonial) => (
          <blockquote className="lp3-testimonial-card" key={testimonial.name}>
            <p>“{testimonial.quote}”</p>
            <footer>
              <cite>{testimonial.name}</cite>
              <span>{testimonial.detail}</span>
            </footer>
          </blockquote>
        ))}
      </div>
    </section>
  );
}