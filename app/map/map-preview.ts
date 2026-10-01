import type {
  Map as MapLibre,
  Popup,
  GeoJSONSource,
  MapLayerMouseEvent,
} from 'maplibre-gl';
import type { MapVacancy } from '@/lib/server/job-map';
import { compactSalary } from '@/lib/vacancy-presentation';
import { stationAtPoint } from './metro-layers';

/** A noninteractive hint: taps still select the pin/list, rather than opening a second list. */
export function installMapPreviews(
  map: MapLibre,
  PopupClass: typeof Popup,
  lookup: (id: string) => MapVacancy | undefined,
) {
  let popup: Popup | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let revision = 0;
  const clear = () => {
    revision++;
    clearTimeout(timer);
    popup?.remove();
    popup = null;
  };
  const show = (event: MapLayerMouseEvent) => {
    clear();
    if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    if (stationAtPoint(map, event.point)) return;
    const feature = event.features?.[0];
    if (!feature || feature.geometry.type !== 'Point') return;
    const coordinates = feature.geometry.coordinates as [number, number];
    const current = revision;
    timer = setTimeout(() => {
      void (async () => {
        const ids = feature.properties.cluster
          ? (
              await (map.getSource('jobs') as GeoJSONSource).getClusterLeaves(
                Number(feature.properties.cluster_id),
                Number(feature.properties.point_count),
                0,
              )
            ).map((f) => String(f.properties?.job))
          : [String(feature.properties.job)];
        if (revision !== current) return;
        const vacancies = [...new Set(ids)]
          .map(lookup)
          .filter((v): v is MapVacancy => !!v);
        const vacancy = vacancies[0];
        if (!vacancy) return;
        const content = document.createElement('div');
        content.className = 'job-map-preview-card';
        const avatar = document.createElement('span');
        avatar.className = 'job-map-preview-avatar';
        avatar.textContent = vacancy.company.slice(0, 1);
        if (vacancy.logoUrl) {
          const img = document.createElement('img');
          img.src = vacancy.logoUrl;
          img.alt = '';
          img.referrerPolicy = 'no-referrer';
          img.addEventListener('error', () => img.remove(), { once: true });
          avatar.append(img);
        }
        const text = document.createElement('div');
        const title = document.createElement('strong');
        title.textContent = vacancy.title;
        const company = document.createElement('span');
        company.textContent = vacancy.company;
        text.append(title, company);
        if (vacancy.salary) {
          const salary = document.createElement('b');
          salary.textContent = compactSalary(
            vacancy.salary,
            vacancy.salaryPeriod,
          );
          text.append(salary);
        }
        const hint = document.createElement('small');
        hint.textContent =
          vacancies.length > 1
            ? `კიდევ ${vacancies.length - 1} ვაკანსია · დააჭირე სანახავად`
            : 'დააჭირე ვაკანსიის სანახავად';
        text.append(hint);
        content.append(avatar, text);
        popup = new PopupClass({
          closeButton: false,
          closeOnClick: false,
          offset: 20,
          maxWidth: '300px',
          className: 'job-map-preview',
        })
          .setLngLat(coordinates)
          .setDOMContent(content)
          .addTo(map);
      })().catch(() => {
        /* The source can change while hovering a filtered cluster. */
      });
    }, 160);
  };
  for (const layer of ['points-hit', 'clusters']) {
    map.on('mouseenter', layer, show);
    map.on('mouseleave', layer, clear);
  }
  map.on('movestart', clear);
  map.on('click', clear);
  map.on('sourcedataloading', (e) => {
    if (e.sourceId === 'jobs') clear();
  });
  map.once('remove', clear);
}
