#import "housekeeping.typ": *
#show: paper

#include "abstract.typ"

= Introduction

Start writing here. The preview updates as you type. Cite sources like
@knuth1984 or @lamport1994 and they appear in the references below.

== Background

Some background text. Inline math like $E = m c^2$ works, as do display equations:

$ integral_0^oo e^(-x^2) dif x = sqrt(pi) / 2 $

= Method

Describe what you did. Put images in `figures/` and include them like this:

// #figure(image("figures/plot.png", width: 80%), caption: [A figure.]) <fig:plot>

= Results

Describe what you found. A table:

#figure(
  table(
    columns: 3,
    [*Setting*], [*Value*], [*Note*],
    [A], [1.0], [baseline],
    [B], [2.5], [improved],
  ),
  caption: [An example table.],
)

= Conclusion

Wrap up.

#bibliography("refs.bib")
