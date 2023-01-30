import { BigNumberish } from '@ethersproject/bignumber';
import { formatUnits } from '@ethersproject/units';
import { Multicaller } from '../../utils';

export const author = 'bonustrack';
export const version = '0.1.1';

const abi = [
  'function balanceOf(address account) external view returns (uint256)'
];

type Balance = {
  erc721: number;
  erc1155: number;
};

export async function strategy(
  space,
  network,
  provider,
  addresses,
  options,
  snapshot
): Promise<Record<string, number>> {
  const blockTag = typeof snapshot === 'number' ? snapshot : 'latest';

  const multi = new Multicaller(network, provider, abi, { blockTag });
  const erc1155TokenId = options.tokenId

  // get the ERC721 balance
  addresses.forEach((address) => {
    multi.call(`${address}-721`, options.address, 'balanceOf', [address])
    multi.call(`${address}-1155`, options.address, 'balanceOf', [address, erc1155TokenId])
  });

  const result: Record<string, BigNumberish> = await multi.execute();
  const balances: Record<string, Balance> = Object.entries(result)
  .reduce((acc, [path, balance]) => {
    const parts = path.split('-');
    const address = parts[0];
    const nftType = parts[1];

    const accountBalances = acc[address] || {erc721: 0, erc1155: 0};
    let newErc721Bal;
    let newErc1155Bal;

    switch (nftType) {
      case '721':
        newErc721Bal = accountBalances.erc721 + balance;
        newErc1155Bal = accountBalances.erc1155;
        acc[address] = {erc721: newErc721Bal, erc1155: newErc1155Bal}
        break
      case '1155':
        newErc721Bal = accountBalances.erc721;
        newErc1155Bal = accountBalances.erc1155 + balance;
        acc[address] = {erc721: newErc721Bal, erc1155: newErc1155Bal}
        break
    }

    return acc
  }, {});

  return Object.fromEntries(
    Object.entries(balances)
    .map(([address, balance]) => [address, Math.min(balance.erc721, balance.erc1155)])
  );
}
