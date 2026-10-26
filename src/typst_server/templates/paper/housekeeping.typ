// Document metadata and layout. Leave a field empty ("") to hide it.
#let title = "{{title}}"
#let author = "Author Name"
#let institution = "Institution, Department"
#let email = "author@example.com"
#let date = datetime.today().display("[month repr:long] [day], [year]")

// Page and text setup, plus the title block. Applied in main.typ with `#show: paper`.
#let paper(body) = {
  set document(title: title, author: if author == "" { () } else { author })
  set page(paper: "a4", margin: (x: 2.5cm, y: 2.5cm), numbering: "1")
  set text(font: "Libertinus Serif", size: 11pt)
  set par(justify: true)
  set heading(numbering: "1.1")
  show figure: set block(above: 1.4em, below: 1.4em)

  align(center)[
    #text(size: 17pt, weight: "bold")[#title]
    #v(0.6em)
    #if author != "" [#author \ ]
    #if institution != "" [#emph(institution) \ ]
    #if email != "" [#link("mailto:" + email) \ ]
    #if date != "" [#v(0.4em) #date]
  ]
  v(1em)
  body
}

// Abstract box. Used in abstract.typ.
#let abstract(body) = align(center)[
  #block(width: 85%)[
    #align(center)[*Abstract*]
    #set text(size: 10pt)
    #align(left, body)
  ]
]
