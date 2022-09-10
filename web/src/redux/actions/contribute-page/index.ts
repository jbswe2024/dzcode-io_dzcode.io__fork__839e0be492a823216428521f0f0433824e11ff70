import debounce from "@material-ui/core/utils/debounce";
import * as Sentry from "@sentry/browser";
import { slices, store } from "src/redux";
import { fetchV2 } from "src/utils/fetch";

/**
 * fetchContributions fetch an array from api and pass it to the store
 */
export const fetchContributions = async (): Promise<void> => {
  store.dispatch(slices.contributePage.actions.set({ contributions: null }));
  try {
    const { contributePage } = store.getState();
    const query: [string, string][] = [];
    contributePage.filters.forEach((filter) => {
      filter.options.forEach((option) => {
        if (option.checked) query.push([filter.name, option.name]);
      });
    });

    const { contributions, filters } = await fetchV2("api:Contributions", { query });

    // restore filters states:
    const checkedFilters: Array<{
      filterName: string;
      optionName: string;
    }> = [];
    contributePage.filters.forEach((filter) => {
      filter.options.forEach((option) => {
        if (option.checked) {
          checkedFilters.push({
            filterName: filter.name,
            optionName: option.name,
          });
        }
      });
    });
    const newFilters = filters.map((filter) => ({
      ...filter,
      options: filter.options.map((option) => ({
        ...option,
        checked: checkedFilters.some(
          ({ filterName, optionName }) => filterName === filter.name && optionName === option.name,
        ),
      })),
    }));
    store.dispatch(slices.contributePage.actions.set({ contributions, filters: newFilters }));
  } catch (error) {
    store.dispatch(slices.contributePage.actions.set({ contributions: "ERROR" }));
    Sentry.captureException(error, { tags: { type: "WEB_FETCH" } });
  }
};

const debouncedFetchContributions = debounce(fetchContributions, 500);

/**
 * updateFilters update filters state and trigger a debounced fetchContributions action
 */
export const updateFilterValue = async (
  filterName: string,
  optionName: string,
  value: boolean,
  updateImmediately = false,
  overwrite = false,
): Promise<void> => {
  const { filters } = store.getState().contributePage;
  const newFilters = filters.map((filter) => {
    if (filter.name !== filterName) {
      return {
        ...filter,
        options: !overwrite
          ? filter.options
          : filter.options.map((option) => {
              return {
                ...option,
                checked: false,
              };
            }),
      };
    } else {
      return {
        ...filter,
        options: filter.options.map((option) => {
          if (option.name !== optionName) {
            return overwrite ? { ...option, checked: false } : option;
          } else {
            return { ...option, checked: value };
          }
        }),
      };
    }
  });
  store.dispatch(slices.contributePage.actions.set({ filters: newFilters }));
  if (!updateImmediately) {
    debouncedFetchContributions();
  } else {
    fetchContributions();
  }
};
