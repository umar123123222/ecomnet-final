import { OutletInventoryView } from "@/components/inventory/OutletInventoryView";
import { PageContainer, PageHeader } from "@/components/layout";

const OutletInventory = () => {
  return (
    <PageContainer>
      <PageHeader
        title="My Outlet Inventory"
        description="View and manage your outlet's stock levels"
      />
      <OutletInventoryView />
    </PageContainer>
  );
};

export default OutletInventory;
