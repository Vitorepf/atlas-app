// Editorial primitives · variante F (Aldine derivada · pegada editorial premium).
// Vocabulário consagrado: WSJ/FT/NYT impresso, Penguin Classics frontispiece,
// Phaidon/Taschen, Monocle TOC, Aldus Manutius (Veneza 1494).
//
// Cada primitiva resolve UM elemento editorial:
//   Masthead             · título da publicação + folio
//   EditorialDateline    · cidade · data · edição
//   SectionHead          · numeral romano + caps title + standfirst + hairline
//   TocRow               · label · dot leader · value (estilo TOC de livro)
//   DestinoItem          · glyph + label + subtitle vertical (destino-list)
//   EditorialPullQuote   · barra vertical bronze + italic + atribuição mono caps
//   FolioFooter          · "— FOLIO N —" rodapé com hairline

export { Masthead } from './Masthead'
export { EditorialDateline } from './EditorialDateline'
export { SectionHead } from './SectionHead'
export { TocRow } from './TocRow'
export { DestinoItem } from './DestinoItem'
export { EditorialPullQuote } from './EditorialPullQuote'
export { FolioFooter } from './FolioFooter'
export { HorizontalGrid } from './HorizontalGrid'
