# Reranker scores

The model is Workers AI `@cf/baai/bge-reranker-base`. These 20 pairs are golden questions and the ground-truth chunk for each question. The run was on 19 November 2026.

low: 0.0004465289821382612

high: 0.9927901029586792

sigmoid: skip

Every score is between 0 and 1. The gateway does not apply a sigmoid. A sigmoid on a score that is already between 0 and 1 would squeeze the labels.

The 20 scores:

- flask-identifier-01: 0.026755793020129204
- flask-identifier-02: 0.013278590515255928
- flask-concept-01: 0.5762714147567749
- flask-concept-02: 0.9871072173118592
- flask-architecture-01: 0.9927901029586792
- flask-architecture-02: 0.008564996533095837
- flask-start-01: 0.0006163682555779815
- flask-feature-01: 0.006834282074123621
- flask-feature-02: 0.4753788411617279
- hono-identifier-01: 0.0004465289821382612
- hono-identifier-02: 0.02409364841878414
- hono-concept-01: 0.587828516960144
- hono-concept-02: 0.7811056971549988
- hono-architecture-01: 0.5020750164985657
- hono-architecture-02: 0.4814454317092895
- hono-start-01: 0.0023619586136192083
- hono-feature-01: 0.01607675664126873
- hono-feature-02: 0.009694911539554596
- zod-identifier-01: 0.0011631448287516832
- zod-identifier-02: 0.0005775465397164226

Identifier pairs scored near 0. Readme and concept pairs scored higher. A later stage that sorts by this score can push a correct definition behind a readme chunk.
