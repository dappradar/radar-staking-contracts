const { expect } = require('chai')
const { ethers } = require("hardhat")
const { BigNumber } = require('ethers')

const token = BigNumber.from(10).pow(18) // a token is 18 decimals
const totalSupply = token.mul(BigNumber.from(10).pow(10)) // 10b

describe('Radar Token', () => {
  before(async () => {
    const users = await ethers.getSigners()
    const [owner] = users

    this.users = users.slice(2)
    this.owner = owner

    const RadarToken = await ethers.getContractFactory('RadarToken')
    this.radarToken = await RadarToken.deploy(
      'RT',
      'RT',
      [this.users[0].address, this.users[1].address],
      [1000, 2000]
    )
  })

  it('check deploy requrements', async () => {
    const RadarToken = await ethers.getContractFactory('RadarToken')
    await expect(RadarToken.deploy(
      'RT',
      'RT',
      [this.users[0].address, this.users[1].address],
      [1000]
    )).to.revertedWith('RadarToken: must have same number of mint addresses and amounts')

    await expect(RadarToken.deploy(
      'RT',
      'RT',
      [this.users[0].address, ethers.constants.AddressZero],
      [1000, 2000]
    )).to.revertedWith('RadarToken: cannot have a non-address as reserve.')
  })

  it('check balance after deployment', async () => {
    // check tokens are distributed to initial holders
    expect(
      (await this.radarToken.balanceOf(this.users[0].address)).toString()
    ).to.equal('1000')

    expect(
      (await this.radarToken.balanceOf(this.users[1].address)).toString()
    ).to.equal('2000')
  })

  it('check decimals', async () => {
    expect(
      await this.radarToken.decimals()
    ).to.equal(18)
  })

  it('burn', async () => {
    const [, bob] = this.users
    await expect(this.radarToken.connect(bob).burn(1500))
      .to.emit(this.radarToken, 'Transfer')
      .withArgs(bob.address, ethers.constants.AddressZero, 1500)
    
    expect(await this.radarToken.balanceOf(bob.address))
      .to.equal(500)
  })
})
