const container = document.getElementById('popup');
const content = document.getElementById('popup-content');
const closer = document.getElementById('popup-closer');

var mapView = new ol.View({
    projection:'EPSG:3857',
    center:ol.proj.fromLonLat([69,30]),
    zoom: 5,
});

const overlay = new ol.Overlay({
  element: container,
});

var map = new ol.Map({
    target:'map',
    view: mapView,
    overlays: [overlay],
    // projection: new ol.proj.Projection("EPSG:4326"),
});

var osmtile = new ol.layer.Tile({
    title:'Open Street Map',
    visible: true,
    source: new ol.source.OSM(),
});

map.addLayer(osmtile);

url = 'http://localhost:8080/geoserver/pak/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=pak%3Apakistan&outputFormat=application%2Fjson';


var pakistanStyle = new ol.style.Style({
        fill: new ol.style.Fill({
            color: 'rgba(255, 255, 255, 0)',
            }),
        stroke: new ol.style.Stroke({
            color: 'blue',
            width: 3,
            }),
});

geojson = new ol.layer.Vector({
    title : 'Pakistan',
    source : new ol.source.Vector({
        url :url,
        format : new ol.format.GeoJSON({
            geometryName: 'geom',
        }),
    }),
    style : pakistanStyle
});
map.addLayer(geojson)

sourceMod = geojson.getSource();

let mapdata = true;
map.on('click',function (event){
    if (mapdata == true){
        let feature = map.forEachFeatureAtPixel(event.pixel,
        function(feature,layer){
            if (layer==geojson){
                return feature;
            }
        });
        if (feature){        
            let popupContent = "<h3> Country :" + feature.get("country")+"</h3>"
            popupContent += "<p> Province :" +feature.get("province")+"</p>"
            popupContent += "<p> District : "+feature.get("district")+"</p>"
            popupContent += "<p> Population : "+feature.get("population")+"</p>"
            popupContent += "<p> Foreigners : "+feature.get("foreigners")+"</p>";
            content.innerHTML = popupContent;
            const coordinate = event.coordinate;
            overlay.setPosition(coordinate);
        }
    }
});


closer.onclick = function () {
  overlay.setPosition(undefined);
  closer.blur();
  return false;
};


let modify = document.querySelector("#modify");
let deleteFeature = document.querySelector("#delete");
let stop = document.querySelector("#stop");
let featureToDB = document.querySelector("#db");
let drawing = document.querySelector("#feature");

let sendingGeoserver = {}

modify.addEventListener("click", () =>{
    modifyFeature();
})

deleteFeature.addEventListener("click", () => {
    delFeature();
});

stop.addEventListener("click",()=>{
    stopediting();
})

featureToDB.addEventListener("click", () =>{
    sentItToDB();
})

function stopediting(){
    mapdata=true;
    map.removeInteraction(draw_add);
}

drawing.addEventListener("change",(e) => {
    mapdata=false;
    let selectedDrawing = e.target.value;
    console.log(selectedDrawing)
    draw_add = new ol.interaction.Draw({
    source:sourceMod,
    type : selectedDrawing,
    geometryName: 'geom',
    })
    map.addInteraction(draw_add);
    draw_add.on('drawend', function(event) {
    let featurePolygon = event.feature;
    feature4326Insert = featurePolygon.clone();
    feature4326Insert.getGeometry().transform('EPSG:3857', 'EPSG:4326');

    sendingGeoserver.insertingFeature = feature4326Insert
})
})

function modifyFeature() {
    mapdata=false;
    draw_add = new ol.interaction.Modify({
    source:sourceMod,
    // type : 'MultiPolygon',
    // geometryName: 'geom',
    })
    map.addInteraction(draw_add);

    draw_add.on('modifyend', function(event) {

        event.features.forEach(function(feature) {
    
        //     // let modifiedCoordinates = feature.getGeometry().getCoordinates();
        //     // console.log(modifiedCoordinates)
        //     // featureModified = feature.clone();
            feature.getGeometry().transform('EPSG:3857','EPSG:4326');
            sendingGeoserver.modifyingFeature = feature;
        // map.addInteraction(feature);
})
})
}

var select = new ol.interaction.Select({
});
map.addInteraction(select);

let selectedFeatures = select.getFeatures();

let delFeature = (event) => {
    mapdata = false;
    // deleteFeature = geojson.getSource().removeFeature(selectedFeatures.item(0));
    let featureToDelete = selectedFeatures.getArray()[0];
    featureToDelete.getGeometry().transform('EPSG:3857', 'EPSG:4326');
    sendingGeoserver.deleteFeature = featureToDelete
};

function sentItToDB(){
    const formatWFS = new ol.format.WFS({
    });
    const node = formatWFS.writeTransaction(
        [sendingGeoserver['insertingFeature']],  // insert
        [sendingGeoserver['modifyingFeature']],       // update
        [sendingGeoserver['deleteFeature']],       // delete
        {
        featureNS: 'http://www.openplans.org/pak',
        featurePrefix: 'pak',
        featureType: 'pakistan',
        srsName: 'urn:ogc:def:crs:EPSG::4326',
        });
    let serializer = new XMLSerializer();
    xmlString = serializer.serializeToString(node);

    // Send WFS-T request to GeoServer
    fetch('http://localhost:8080/geoserver/pak/wfs', {
        method: 'POST',
        headers: {
            'Content-Type': 'text/xml'
        },
        body: xmlString
    })
    .then(response => response.text())
    .then(data => {
        console.log('WFS Transaction response:', data);
        alert("Data Successfully Update",data)
    })
    .catch(error => {
        console.error('Error:', error);
    });

};



