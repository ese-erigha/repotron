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

## Passage with the chunk title

The same 20 pairs were scored again. Each passage used the embedding form `title: path symbol | text: content`. The run was on 19 November 2026.

title-low: 0.0002948356559500098

title-high: 0.9974787831306458

title-sigmoid: skip

Every score is still between 0 and 1. The gateway still does not apply a sigmoid.

The 20 scores with the title:

- flask-identifier-01: 0.01669890061020851
- flask-identifier-02: 0.04776748642325401
- flask-concept-01: 0.9924238920211792
- flask-concept-02: 0.9974787831306458
- flask-architecture-01: 0.8273326754570007
- flask-architecture-02: 0.03370131552219391
- flask-start-01: 0.0002948356559500098
- flask-feature-01: 0.004839644301682711
- flask-feature-02: 0.5439704060554504
- hono-identifier-01: 0.001175458077341318
- hono-identifier-02: 0.042528510093688965
- hono-concept-01: 0.7843500375747681
- hono-concept-02: 0.9930950999259948
- hono-architecture-01: 0.10649193078279497
- hono-architecture-02: 0.9846591949462892
- hono-start-01: 0.0025460664182901382
- hono-feature-01: 0.0035031007137149572
- hono-feature-02: 0.005534414201974869
- zod-identifier-01: 0.000859441701322794
- zod-identifier-02: 0.0007324513280764222

The title does not fix the order. Zod definitions stay near 0. Flask concept pairs stay near 1. Stage 6 does not sort the answer list by this score.

## mongodb/rerank-3

The model is OpenRouter `mongodb/rerank-3`. These are the same 20 pairs. The passage is the header, then the content. The query text is the user question. The run was on 20 November 2026. The chunks a user receives stay in the current order.

rerank-low: 0.5245599746704102

rerank-high: 0.9392402172088623

rerank-sigmoid: skip

Every score is between 0 and 1. The gateway does not apply a sigmoid.

The 20 scores:

- flask-identifier-01: 0.8271173238754272
- flask-identifier-02: 0.8927371501922607
- flask-concept-01: 0.9370020031929016
- flask-concept-02: 0.9073042273521423
- flask-architecture-01: 0.9392402172088623
- flask-architecture-02: 0.763560950756073
- flask-start-01: 0.5245599746704102
- flask-feature-01: 0.643302321434021
- flask-feature-02: 0.7635424733161926
- hono-identifier-01: 0.8952884078025818
- hono-identifier-02: 0.7843691110610962
- hono-concept-01: 0.8518349528312683
- hono-concept-02: 0.8856191039085388
- hono-architecture-01: 0.8137436509132385
- hono-architecture-02: 0.9336104989051819
- hono-start-01: 0.6280539035797119
- hono-feature-01: 0.5663411021232605
- hono-feature-02: 0.6066926121711731
- zod-identifier-01: 0.8116143345832825
- zod-identifier-02: 0.8468188643455505

The highest score is "What is Flask?". Every definition scores below that readme when each pair uses its own question. That comparison does not decide the sort.

## Same question

Each definition question was sent again with two chunks in one call. One chunk is the function. The other chunk is the readme. The run was on 20 November 2026. The Zod readme chunk is `packages/zod/README.md`. The Hono readme chunk is the Features section.

- flask-identifier-01: function 0.8271018862724304, readme 0.34157463908195496
- flask-identifier-02: function 0.8926522135734558, readme 0.35141295194625854
- hono-identifier-01: function 0.895628809928894, readme 0.4333249628543854
- hono-identifier-02: function 0.7847803235054016, readme 0.3861027657985687
- zod-identifier-01: function 0.812028169631958, readme 0.49664658308029175
- zod-identifier-02: function 0.8470751643180847, readme 0.5153801441192627
- flask-concept-02: function 0.9073803424835205, readme 0.45674341917037964

The function scores above the readme for the same question. The retrieved chunks are sorted by this score. A "where is" question still keeps the named function first.
