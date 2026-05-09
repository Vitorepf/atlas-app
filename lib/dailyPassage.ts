// =============================================================================
// PASSAGEM DO DIA · canon do Atlas
// =============================================================================
// Banco curado de 100 entradas — sabedoria que venceu o tempo.
//
// Critério Lindy formal: ≥ 100 anos de morte do autor (regra padrão), ou 3
// exceções qualificadas pós-1900 (inflexão histórica + texto canônico em
// academia + consenso entre tradições adversárias).
//
// O dever do campo: se existisse um sábio que falasse com você uma única vez
// por dia, todos os dias, com objetivo de mudar a sua vida — o que ele diria?
// Cada entrada cumpre os 5 invariantes técnicos:
//   1. ≤ 14 palavras (compactação)
//   2. Estrutura recursiva (cada releitura abre camada nova)
//   3. Tensão não-resolvida (paradoxo, contraste, pergunta sem resposta única)
//   4. Imagem concreta como veículo
//   5. Cadência re-citável (ritmo audível)
//
// Documentação completa do critério, casas e mestres: docs/passagem-do-dia-canon.md
// =============================================================================

export interface Passage {
  /** A frase em português · ≤ ~14 palavras. Pode ser fragmento traduzido. */
  text: string
  /**
   * Autor + obra/contexto verificável em fonte primária. Quando vier de
   * paráfrase canônica (concentração de ideia distribuída em mais de uma
   * passagem do autor), marcar com "(paráfrase)".
   */
  attribution: string
  /** Casa do canon · ver docs/passagem-do-dia-canon.md. */
  house:
    | 'sagrada'
    | 'classica'
    | 'militar'
    | 'estadista'
    | 'moderna'
    | 'literatura'
    | 'pragmatismo'
    | 'lusobrasileira'
}

// As 100 passagens canônicas. Ordem é deliberada — distribui as casas pra que
// o leitor não receba 5 estoicos em sequência. Mistura tonal pra preservar
// surpresa diária.
const PASSAGES: readonly Passage[] = [
  // ─── 001 ─── I · Sagrada
  { text: 'O temor do Senhor é o princípio do conhecimento.', attribution: 'Provérbios 1:7', house: 'sagrada' },
  // ─── 002 ─── II · Clássica
  { text: 'Tu és aquilo a que dás importância.', attribution: 'Marco Aurélio · Meditações VII', house: 'classica' },
  // ─── 003 ─── III · Militar
  { text: 'Conhece o teu inimigo e a ti mesmo: em cem batalhas não correrás perigo.', attribution: 'Sun Tzu · A Arte da Guerra III', house: 'militar' },
  // ─── 004 ─── I · Sagrada
  { text: 'Se não sou por mim, quem é por mim? Se sou só por mim, o que sou?', attribution: 'Hillel · Pirkei Avot 1.14', house: 'sagrada' },
  // ─── 005 ─── II · Clássica
  { text: 'Não somos perturbados pelas coisas, mas pelas opiniões que delas temos.', attribution: 'Epicteto · Manual V', house: 'classica' },
  // ─── 006 ─── V · Moderna
  { text: 'Aquele que tem um porquê suporta quase qualquer como.', attribution: 'Nietzsche · Crepúsculo dos Ídolos', house: 'moderna' },
  // ─── 007 ─── I · Sagrada
  { text: 'Vaidade de vaidades, tudo é vaidade.', attribution: 'Eclesiastes 1:2', house: 'sagrada' },
  // ─── 008 ─── II · Clássica
  { text: 'Não se entra duas vezes no mesmo rio.', attribution: 'Heráclito · fragmento 91', house: 'classica' },
  // ─── 009 ─── III · Militar
  { text: 'A suprema arte da guerra é submeter o inimigo sem combate.', attribution: 'Sun Tzu · A Arte da Guerra III', house: 'militar' },
  // ─── 010 ─── I · Sagrada
  { text: 'Quem conhece os outros é sábio; quem conhece a si mesmo é iluminado.', attribution: 'Lao Tzu · Tao Te Ching 33', house: 'sagrada' },

  // ─── 011 ─── IV · Estadista
  { text: 'Faz o que puderes, com o que tens, onde estás.', attribution: 'Theodore Roosevelt · autobiografia 1913', house: 'estadista' },
  // ─── 012 ─── II · Clássica
  { text: 'Onde quer que vás, leva-te contigo.', attribution: 'Marco Aurélio · Meditações IV', house: 'classica' },
  // ─── 013 ─── VI · Literatura
  { text: 'Ser ou não ser: eis a questão.', attribution: 'Shakespeare · Hamlet III.1', house: 'literatura' },
  // ─── 014 ─── I · Sagrada
  { text: 'Em lugar onde não há homens, esforça-te tu por ser um homem.', attribution: 'Hillel · Pirkei Avot 2.5', house: 'sagrada' },
  // ─── 015 ─── II · Clássica
  { text: 'Não é o homem pobre quem tem pouco; é o que deseja mais.', attribution: 'Sêneca · Cartas a Lucílio II', house: 'classica' },
  // ─── 016 ─── III · Militar
  { text: 'A guerra é a continuação da política por outros meios.', attribution: 'Carl von Clausewitz · Da Guerra I', house: 'militar' },
  // ─── 017 ─── V · Moderna
  { text: 'Toda infelicidade do homem vem de não saber ficar quieto num quarto.', attribution: 'Pascal · Pensamentos 139', house: 'moderna' },
  // ─── 018 ─── I · Sagrada
  { text: 'A árvore conhece-se pelos seus frutos.', attribution: 'Mateus 7:20', house: 'sagrada' },
  // ─── 019 ─── II · Clássica
  { text: 'Conhece-te a ti mesmo.', attribution: 'inscrição de Delfos · Sócrates', house: 'classica' },
  // ─── 020 ─── VIII · Luso-brasileira
  { text: 'Viver é muito perigoso.', attribution: 'Guimarães Rosa · Grande Sertão: Veredas', house: 'lusobrasileira' },

  // ─── 021 ─── III · Militar
  { text: 'Toda guerra é baseada no engano.', attribution: 'Sun Tzu · A Arte da Guerra I', house: 'militar' },
  // ─── 022 ─── I · Sagrada
  { text: 'A jornada de mil li começa com um único passo.', attribution: 'Lao Tzu · Tao Te Ching 64', house: 'sagrada' },
  // ─── 023 ─── II · Clássica
  { text: 'Uma vida não examinada não vale a pena ser vivida.', attribution: 'Sócrates · Apologia 38a', house: 'classica' },
  // ─── 024 ─── V · Moderna
  { text: 'O que não me mata fortalece-me.', attribution: 'Nietzsche · Crepúsculo dos Ídolos · Máximas', house: 'moderna' },
  // ─── 025 ─── I · Sagrada
  { text: 'Para tudo há um tempo debaixo do céu.', attribution: 'Eclesiastes 3:1', house: 'sagrada' },
  // ─── 026 ─── III · Militar
  { text: 'É melhor ser temido que amado, se não se pode ser ambos.', attribution: 'Maquiavel · O Príncipe XVII', house: 'militar' },
  // ─── 027 ─── II · Clássica
  { text: 'Enquanto esperamos viver, a vida passa.', attribution: 'Sêneca · De Brevitate Vitae I', house: 'classica' },
  // ─── 028 ─── IV · Estadista
  { text: 'Sobre o trono mais alto, ainda estamos sentados sobre o nosso traseiro.', attribution: 'Montaigne · Ensaios III.13', house: 'estadista' },
  // ─── 029 ─── I · Sagrada
  { text: 'Como as águas profundas é o conselho no coração do homem.', attribution: 'Provérbios 20:5', house: 'sagrada' },
  // ─── 030 ─── II · Clássica
  { text: 'O caráter do homem é o seu destino.', attribution: 'Heráclito · fragmento 119', house: 'classica' },

  // ─── 031 ─── VI · Literatura
  { text: 'Antes de tudo, sê verdadeiro contigo mesmo.', attribution: 'Shakespeare · Hamlet I.3', house: 'literatura' },
  // ─── 032 ─── I · Sagrada
  { text: 'Aprender sem pensar é trabalho perdido; pensar sem aprender é perigoso.', attribution: 'Confúcio · Analectos 2.15', house: 'sagrada' },
  // ─── 033 ─── III · Militar
  { text: 'Tudo na guerra é simples; mas o mais simples é difícil.', attribution: 'Carl von Clausewitz · Da Guerra I', house: 'militar' },
  // ─── 034 ─── II · Clássica
  { text: 'Não exijas que as coisas sejam como queres; quere que sejam como são.', attribution: 'Epicteto · Manual VIII', house: 'classica' },
  // ─── 035 ─── V · Moderna
  { text: 'A vida é vivida para a frente, mas só pode ser entendida para trás.', attribution: 'Kierkegaard · Diário 1843', house: 'moderna' },
  // ─── 036 ─── I · Sagrada
  { text: 'Quem semeia vento colhe tempestade.', attribution: 'Oséias 8:7', house: 'sagrada' },
  // ─── 037 ─── II · Clássica
  { text: 'A excelência moral resulta do hábito.', attribution: 'Aristóteles · Ética a Nicômaco II', house: 'classica' },
  // ─── 038 ─── VII · Pragmatismo
  { text: 'A maioria dos homens leva vidas de silenciosa desespero.', attribution: 'Thoreau · Walden', house: 'pragmatismo' },
  // ─── 039 ─── III · Militar
  { text: 'Não há nada fora de ti que te faça vencer.', attribution: 'Miyamoto Musashi · Livro dos Cinco Anéis', house: 'militar' },
  // ─── 040 ─── VIII · Luso-brasileira
  { text: 'Ao vencido, ódio ou compaixão; ao vencedor, as batatas.', attribution: 'Machado de Assis · Quincas Borba', house: 'lusobrasileira' },

  // ─── 041 ─── I · Sagrada
  { text: 'Bem-aventurados os mansos, porque herdarão a terra.', attribution: 'Mateus 5:5', house: 'sagrada' },
  // ─── 042 ─── II · Clássica
  { text: 'Não és senhor do que se passa fora de ti; és senhor da tua opinião.', attribution: 'Epicteto · Manual I', house: 'classica' },
  // ─── 043 ─── V · Moderna
  { text: 'Quem combate monstros que se assegure de não tornar-se um.', attribution: 'Nietzsche · Além do Bem e do Mal IV.146', house: 'moderna' },
  // ─── 044 ─── I · Sagrada
  { text: 'O orgulho precede a queda.', attribution: 'Provérbios 16:18', house: 'sagrada' },
  // ─── 045 ─── III · Militar
  { text: 'A oportunidade de vencer é dada pelo próprio inimigo.', attribution: 'Sun Tzu · A Arte da Guerra IV', house: 'militar' },
  // ─── 046 ─── II · Clássica
  { text: 'A felicidade da tua vida depende da qualidade dos teus pensamentos.', attribution: 'Marco Aurélio · Meditações V', house: 'classica' },
  // ─── 047 ─── IV · Estadista
  { text: 'Não adies para amanhã o que podes fazer hoje.', attribution: 'Benjamin Franklin · Pobre Ricardo', house: 'estadista' },
  // ─── 048 ─── I · Sagrada
  { text: 'Confia no Senhor de todo o teu coração; e não te apoies no teu próprio entendimento.', attribution: 'Provérbios 3:5', house: 'sagrada' },
  // ─── 049 ─── II · Clássica
  { text: 'Sei que nada sei.', attribution: 'Sócrates · em Platão · Apologia', house: 'classica' },
  // ─── 050 ─── VIII · Luso-brasileira
  { text: 'Tudo vale a pena se a alma não é pequena.', attribution: 'Fernando Pessoa · Mensagem', house: 'lusobrasileira' },

  // ─── 051 ─── I · Sagrada
  { text: 'Não te alegres quando cair o teu inimigo.', attribution: 'Provérbios 24:17', house: 'sagrada' },
  // ─── 052 ─── III · Militar
  { text: 'Vim, vi, venci.', attribution: 'Júlio César · após a batalha de Zela, 47 a.C.', house: 'militar' },
  // ─── 053 ─── II · Clássica
  { text: 'Não é porque é difícil que não ousamos; é porque não ousamos que é difícil.', attribution: 'Sêneca · Cartas a Lucílio CIV', house: 'classica' },
  // ─── 054 ─── V · Moderna
  { text: 'O coração tem razões que a razão desconhece.', attribution: 'Pascal · Pensamentos 423', house: 'moderna' },
  // ─── 055 ─── I · Sagrada
  { text: 'Não te aflijas em não seres conhecido; aflige-te em mereceres ser.', attribution: 'Confúcio · Analectos 1.16', house: 'sagrada' },
  // ─── 056 ─── II · Clássica
  { text: 'A natureza ama esconder-se.', attribution: 'Heráclito · fragmento 123', house: 'classica' },
  // ─── 057 ─── VI · Literatura
  { text: 'Considerai a vossa semente: não fostes feitos para viver como brutos.', attribution: 'Dante · Inferno XXVI', house: 'literatura' },
  // ─── 058 ─── III · Militar
  { text: 'Quem vence sem lutar é o melhor.', attribution: 'Sun Tzu · A Arte da Guerra III', house: 'militar' },
  // ─── 059 ─── I · Sagrada
  { text: 'O dia é curto, o trabalho é muito.', attribution: 'Rabi Tarfon · Pirkei Avot 2.15', house: 'sagrada' },
  // ─── 060 ─── II · Clássica
  { text: 'Lembra-te: és um actor numa peça de autor alheio.', attribution: 'Epicteto · Manual XVII', house: 'classica' },

  // ─── 061 ─── IV · Estadista
  { text: 'Se queres pôr à prova um homem, dá-lhe poder.', attribution: 'Abraham Lincoln · 1854 (paráfrase)', house: 'estadista' },
  // ─── 062 ─── I · Sagrada
  { text: 'O coração alegre é bom remédio.', attribution: 'Provérbios 17:22', house: 'sagrada' },
  // ─── 063 ─── III · Militar
  { text: 'Nunca interrompas o inimigo quando ele está cometendo um erro.', attribution: 'atribuído a Napoleão Bonaparte', house: 'militar' },
  // ─── 064 ─── II · Clássica
  { text: 'Há mais coisas que nos assustam do que nos esmagam.', attribution: 'Sêneca · Cartas a Lucílio XIII', house: 'classica' },
  // ─── 065 ─── V · Moderna
  { text: 'A solidão é o destino dos espíritos eminentes.', attribution: 'Schopenhauer · Aforismos sobre Sabedoria de Vida', house: 'moderna' },
  // ─── 066 ─── I · Sagrada
  { text: 'O que olha para o vento nunca semeará.', attribution: 'Eclesiastes 11:4', house: 'sagrada' },
  // ─── 067 ─── VI · Literatura
  { text: 'Cada um de nós é responsável por todos diante de todos.', attribution: 'Dostoiévski · Os Irmãos Karamazov', house: 'literatura' },
  // ─── 068 ─── II · Clássica
  { text: 'Tudo o que ouvimos é uma opinião, não um fato.', attribution: 'Marco Aurélio · Meditações IV', house: 'classica' },
  // ─── 069 ─── III · Militar
  { text: 'Os homens esquecem mais depressa a morte do pai que a perda do património.', attribution: 'Maquiavel · O Príncipe XVII', house: 'militar' },
  // ─── 070 ─── I · Sagrada
  { text: 'Não faças aos outros o que não queres que te façam.', attribution: 'Confúcio · Analectos 15.24', house: 'sagrada' },

  // ─── 071 ─── V · Moderna
  { text: 'Toda a infelicidade do homem vem de uma só coisa.', attribution: 'Pascal · Pensamentos 139 (paráfrase)', house: 'moderna' },
  // ─── 072 ─── II · Clássica
  { text: 'Os fortes fazem o que podem; os fracos sofrem o que devem.', attribution: 'Tucídides · História V.89', house: 'classica' },
  // ─── 073 ─── IV · Estadista
  { text: 'A coragem não é a ausência do medo, mas o triunfo sobre ele.', attribution: 'Nelson Mandela · Long Walk to Freedom', house: 'estadista' },
  // ─── 074 ─── I · Sagrada
  { text: 'Não te incumbe completar a obra, mas tampouco és livre para abandoná-la.', attribution: 'Rabi Tarfon · Pirkei Avot 2.16', house: 'sagrada' },
  // ─── 075 ─── III · Militar
  { text: 'A verdade não está no caminho dos outros.', attribution: 'Miyamoto Musashi · Dokkodo (paráfrase)', house: 'militar' },
  // ─── 076 ─── II · Clássica
  { text: 'A vida sem livros é como uma cidade sem muralhas.', attribution: 'Cícero · Ad Familiares', house: 'classica' },
  // ─── 077 ─── V · Moderna
  { text: 'Não rir, não chorar, não detestar — mas compreender.', attribution: 'Spinoza · Tratado Político I.4', house: 'moderna' },
  // ─── 078 ─── I · Sagrada
  { text: 'A água vence o duro pela suavidade.', attribution: 'Lao Tzu · Tao Te Ching 78', house: 'sagrada' },
  // ─── 079 ─── VIII · Luso-brasileira
  { text: 'A vida é uma ópera.', attribution: 'Machado de Assis · Dom Casmurro', house: 'lusobrasileira' },
  // ─── 080 ─── II · Clássica
  { text: 'Não esperes a República de Platão; basta avançar um pouquinho.', attribution: 'Marco Aurélio · Meditações IX', house: 'classica' },

  // ─── 081 ─── III · Militar
  { text: 'Quem deseja o fim deve querer os meios.', attribution: 'Maquiavel · O Príncipe (paráfrase)', house: 'militar' },
  // ─── 082 ─── V · Moderna
  { text: 'Age só segundo a máxima que possa querer ser lei universal.', attribution: 'Kant · Fundamentação da Metafísica dos Costumes', house: 'moderna' },
  // ─── 083 ─── II · Clássica
  { text: 'O homem é a medida de todas as coisas.', attribution: 'Protágoras · em Platão · Teeteto 152a', house: 'classica' },
  // ─── 084 ─── VI · Literatura
  { text: 'Não há nada bom nem mau, mas o pensamento o faz ser.', attribution: 'Shakespeare · Hamlet II.2', house: 'literatura' },
  // ─── 085 ─── I · Sagrada
  { text: 'O homem sábio não acumula.', attribution: 'Lao Tzu · Tao Te Ching 81', house: 'sagrada' },
  // ─── 086 ─── II · Clássica
  { text: 'A vida é longa, se sabes usá-la.', attribution: 'Sêneca · De Brevitate Vitae', house: 'classica' },
  // ─── 087 ─── VII · Pragmatismo
  { text: 'Confia em ti mesmo: cada coração vibra com essa corda de ferro.', attribution: 'Emerson · Self-Reliance 1841', house: 'pragmatismo' },
  // ─── 088 ─── III · Militar
  { text: 'Cada um forja a sua própria fortuna.', attribution: 'Salústio · Ad Caesarem', house: 'militar' },
  // ─── 089 ─── V · Moderna
  { text: 'Cada um toma os limites do seu campo de visão pelos limites do mundo.', attribution: 'Schopenhauer · O Mundo como Vontade e Representação', house: 'moderna' },
  // ─── 090 ─── VI · Literatura
  { text: 'Todos pensam em mudar o mundo; ninguém pensa em mudar a si mesmo.', attribution: 'Tolstói · Diário (paráfrase canónica)', house: 'literatura' },

  // ─── 091 ─── I · Sagrada
  { text: 'Há tempo de plantar e tempo de colher o que se plantou.', attribution: 'Eclesiastes 3:2', house: 'sagrada' },
  // ─── 092 ─── II · Clássica
  { text: 'Toda arte e toda investigação visa a algum bem.', attribution: 'Aristóteles · Ética a Nicômaco I', house: 'classica' },
  // ─── 093 ─── IV · Estadista
  { text: 'A felicidade está na liberdade; a liberdade está na coragem.', attribution: 'Péricles · oração fúnebre · em Tucídides II.43', house: 'estadista' },
  // ─── 094 ─── V · Moderna
  { text: 'A virtude não iria longe se a vaidade não a acompanhasse.', attribution: 'La Rochefoucauld · Máximas 200', house: 'moderna' },
  // ─── 095 ─── II · Clássica
  { text: 'Não tememos a morte, mas a ideia da morte.', attribution: 'Sêneca · Cartas a Lucílio XXX', house: 'classica' },
  // ─── 096 ─── VI · Literatura
  { text: 'O que não tens herdado, conquista-o para o possuir.', attribution: 'Goethe · Fausto I', house: 'literatura' },
  // ─── 097 ─── VII · Pragmatismo
  { text: 'Como podes ouvir-te se não ficas calado?', attribution: 'Thoreau · Walden (paráfrase)', house: 'pragmatismo' },
  // ─── 098 ─── IV · Estadista
  { text: 'Pequeno descuido pode resultar em grande mal.', attribution: 'Benjamin Franklin · Pobre Ricardo', house: 'estadista' },
  // ─── 099 ─── VIII · Luso-brasileira
  { text: 'Mudam-se os tempos, mudam-se as vontades.', attribution: 'Camões · soneto 1572', house: 'lusobrasileira' },
  // ─── 100 ─── VIII · Luso-brasileira
  { text: 'Para ser grande, sê inteiro.', attribution: 'Fernando Pessoa · Odes de Ricardo Reis', house: 'lusobrasileira' },
] as const

/**
 * Retorna a passagem do dia · rotação determinística pelo dia desde a fundação.
 *
 * Mesmo dia → mesma passagem (estável dentro do dia, leitor pode revisitar).
 * Em 100 dias toda a coleção toca uma vez. No 101º, volta a primeira — o leitor
 * reencontra a passagem com mais 100 dias de vida em cima e abre nova camada.
 *
 * @param daysSinceFoundation Dias acumulados desde a fundação do Atlas (≥ 1).
 *   Vem do `dailyFolio().number` em `app/index.tsx`.
 */
export function dailyPassage(daysSinceFoundation: number): Passage {
  const len = PASSAGES.length
  // ((x % n) + n) % n — funciona pra n positivos e x negativos. Defensivo.
  const idx = (((daysSinceFoundation - 1) % len) + len) % len
  return PASSAGES[idx]!
}

/** Total de entradas no banco · útil pra testes e telemetria. */
export const PASSAGE_COUNT = PASSAGES.length
