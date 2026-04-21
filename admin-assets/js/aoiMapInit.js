document.addEventListener("DOMContentLoaded", function () {
  const aoiInputs = document.querySelectorAll('.aoi-map-data');
  const initializedMaps = {};

  aoiInputs.forEach(input => {
    const index = input.getAttribute('data-index');
    const filename = input.getAttribute('data-file');
    const modalId = 'detailsModal-' + index;
    const modalElement = document.getElementById(modalId);
    const mapContainerId = 'map-' + index;

    if (!filename || !modalElement) return;

    modalElement.addEventListener('shown.bs.modal', function () {
      if (!initializedMaps[index]) {
        const map = new ol.Map({
          target: mapContainerId,
          layers: [
            new ol.layer.Tile({
              source: new ol.source.OSM({
                attributions: '© OpenStreetMap contributors'
              })
            })
          ],
          view: new ol.View({
            center: ol.proj.fromLonLat([93, 26]),
            zoom: 6
          })
        });

        const vectorSource = new ol.source.Vector({
          url: '/datarequests/aoi/' + filename,
          format: new ol.format.GeoJSON()
        });

        const vectorLayer = new ol.layer.Vector({
          source: vectorSource,
          style: new ol.style.Style({
            stroke: new ol.style.Stroke({
              color: 'blue',
              width: 2
            }),
            fill: new ol.style.Fill({
              color: 'rgba(0, 0, 255, 0.1)'
            })
          })
        });

        map.addLayer(vectorLayer);

        vectorSource.on('featuresloadend', function () {
          if (vectorSource.getFeatures().length > 0) {
            map.getView().fit(vectorSource.getExtent(), { padding: [20, 20, 20, 20], duration: 800 });
          }
        });

        initializedMaps[index] = map;
      } else {
        initializedMaps[index].updateSize();
      }
    });
  });
});
