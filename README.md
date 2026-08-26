# Argentina Poverty Atlas

Public interactive atlas for governed poverty estimates in Argentina.

This repository is the **presentation and map-delivery layer** of a larger scientific system. It does not calculate poverty, train income models, sample Census microdata, define official geography, or own poverty-line sources. It consumes versioned releases and turns them into a clear, inspectable, shareable public experience.

The initial implementation will use **synthetic fixture data** end-to-end so product, mapping, accessibility, lineage and deployment can mature independently of the first real poverty estimate.

> Fixture values are demonstration data only. They are not poverty estimates and must never be presented as observed or official statistics.

Architecture, data contracts, Mapbox operations and the delivery program are being established in the first development seed PR.
